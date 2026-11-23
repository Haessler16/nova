import { ReservationGuestRole } from '@prisma/client';
import { classifyAgeGroup, evaluatePartyReadiness } from './reservation-party';
import { formatCalendarDate } from './reservation-dates';
import type {
  PartyMemberRow,
  PartyReservationRow,
  ReservationPartyMemberResponse,
  ReservationPartyResponse,
} from './reservation-party.contracts';

export function mapPartyResponse(reservation: PartyReservationRow): ReservationPartyResponse {
  const sourceRows = partyRows(reservation);
  const members = sourceRows.map((row) => toResponseMember(row, reservation.checkInDate));
  const namesById = new Map(
    members
      .filter((member) => member.reservationGuestId !== null)
      .map((member) => [member.reservationGuestId as string, member.fullName]),
  );
  for (const member of members) {
    member.responsibleName =
      member.responsibleReservationGuestId === null
        ? null
        : (namesById.get(member.responsibleReservationGuestId) ?? null);
  }

  const primary = members.find((member) => member.role === ReservationGuestRole.PRIMARY) ?? null;
  const companions = members.filter((member) => member.role !== ReservationGuestRole.PRIMARY);
  const readiness = evaluatePartyReadiness({
    members: sourceRows.map((row) => toReadinessMember(row)),
    checkInDate: reservation.checkInDate,
    primaryGuestId: reservation.guestId,
    declaredAdults: reservation.adults,
    declaredChildren: reservation.children,
  });

  return {
    reservationId: reservation.id,
    code: reservation.code,
    status: reservation.status,
    primary,
    companions,
    summary: {
      adults: readiness.counts.adults,
      minors: readiness.counts.minors,
      unknown: readiness.counts.unknown,
      declaredAdults: reservation.adults,
      declaredChildren: reservation.children,
    },
    readiness: {
      checkIn: readiness.checkInBlocked ? 'BLOCKED' : 'ALLOWED',
      fnrh: readiness.legalCodes.length
        ? 'BLOCKED'
        : readiness.fnrhReady
          ? 'READY'
          : 'INCOMPLETE',
      codes: readiness.codes,
      legalCodes: readiness.legalCodes,
    },
  };
}

/**
 * Reservations created before the party existed only have the primary guest.
 * The synthetic row keeps those parties readable without a backfill.
 */
function partyRows(reservation: PartyReservationRow): PartyMemberRow[] {
  if (reservation.guests.length > 0) {
    return reservation.guests;
  }
  return [
    {
      id: null,
      guestId: reservation.guestId,
      role: ReservationGuestRole.PRIMARY,
      legalIncapacity: false,
      minorSupervision: null,
      authorizationReference: null,
      responsibleReservationGuestId: null,
      guest: {
        ...reservation.guest,
        documentType: null,
        documentNumber: null,
        fnrhProfile: null,
      },
    },
  ];
}

function toResponseMember(
  row: PartyMemberRow,
  checkInDate: Date,
): ReservationPartyMemberResponse {
  const birthDate = row.guest.fnrhProfile?.birthDate ?? null;
  return {
    reservationGuestId: row.id,
    guestId: row.guestId,
    fullName: row.guest.fullName,
    email: row.guest.email,
    phone: row.guest.phone,
    documentType: row.guest.documentType,
    documentNumber: row.guest.documentNumber,
    birthDate: birthDate ? formatCalendarDate(birthDate) : null,
    ageAtCheckIn: birthDate ? ageAtDate(birthDate, checkInDate) : null,
    ageGroup: classifyAgeGroup(birthDate, checkInDate),
    role: row.role,
    legalIncapacity: row.legalIncapacity,
    minorSupervision: row.minorSupervision,
    authorizationReference: row.authorizationReference,
    responsibleReservationGuestId: row.responsibleReservationGuestId,
    responsibleName: null,
  };
}

function toReadinessMember(row: PartyMemberRow) {
  return {
    id: row.id,
    guestId: row.guestId,
    role: row.role,
    birthDate: row.guest.fnrhProfile?.birthDate ?? null,
    documentType: row.guest.documentType,
    documentNumber: row.guest.documentNumber,
    legalIncapacity: row.legalIncapacity,
    minorSupervision: row.minorSupervision,
    authorizationReference: row.authorizationReference,
    responsibleReservationGuestId: row.responsibleReservationGuestId,
  };
}

function ageAtDate(birthDate: Date, checkInDate: Date): number {
  const age = checkInDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    checkInDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (checkInDate.getUTCMonth() === birthDate.getUTCMonth() &&
      checkInDate.getUTCDate() < birthDate.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}
