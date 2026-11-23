import { GuestAgeGroup, MinorSupervision } from '@prisma/client';
import type { UpdateReservationGuestDto } from './dto/reservation.dto';
import { classifyAgeGroup } from './reservation-party';
import type { PartyReservationRow, PartyRow, Transaction } from './reservation-party.contracts';
import {
  assertAuthorizationReference,
  assertDocumentPair,
  assertMinorIsLegallyCapable,
  assertPrimaryIsAdult,
  resolveResponsible,
  resolveSupervision,
} from './reservation-party.rules';

export interface PartyUpdateRules {
  ageGroup: GuestAgeGroup;
  legalIncapacity: boolean;
  supervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleId: string | null;
}

/**
 * Validates the party-level rules for an update and resolves the supervision,
 * authorization reference and responsible derived from them.
 */
export function resolveUpdateRules(
  reservation: PartyReservationRow,
  current: PartyRow,
  nextBirthDate: Date | null,
  dto: UpdateReservationGuestDto,
): PartyUpdateRules {
  const ageGroup = classifyAgeGroup(nextBirthDate, reservation.checkInDate);
  const legalIncapacity = dto.legalIncapacity ?? current.legalIncapacity;

  assertPrimaryIsAdult(current.role, ageGroup, legalIncapacity);
  assertMinorIsLegallyCapable(ageGroup, legalIncapacity);

  const requiresResponsible = ageGroup === GuestAgeGroup.MINOR || legalIncapacity;
  const responsible = resolveResponsible(
    reservation.guests.filter((row) => row.id !== current.id),
    dto.responsibleReservationGuestId ?? current.responsibleReservationGuestId ?? undefined,
    requiresResponsible,
    reservation.checkInDate,
  );
  const supervision =
    ageGroup === GuestAgeGroup.MINOR
      ? resolveSupervision(ageGroup, dto.minorSupervision ?? current.minorSupervision ?? undefined)
      : null;
  const authorizationReference =
    supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
      ? ((dto.authorizationReference ?? current.authorizationReference)?.trim() ?? null)
      : null;
  assertAuthorizationReference(supervision, authorizationReference ?? undefined);

  return {
    ageGroup,
    legalIncapacity,
    supervision,
    authorizationReference,
    responsibleId: requiresResponsible ? (responsible?.id ?? null) : null,
  };
}

/** Persists the optional identity fields of the guest, validating the document pair. */
export async function applyGuestIdentity(
  transaction: Transaction,
  guest: { id: string; documentType: PartyRow['guest']['documentType']; documentNumber: string | null },
  dto: UpdateReservationGuestDto,
): Promise<void> {
  if (!hasIdentityChanges(dto)) {
    return;
  }

  assertDocumentPair(
    dto.documentType !== undefined ? dto.documentType : guest.documentType,
    dto.documentNumber !== undefined ? dto.documentNumber : guest.documentNumber,
  );

  await transaction.guest.update({
    where: { id: guest.id },
    data: {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
      ...(dto.documentType !== undefined ? { documentType: dto.documentType } : {}),
      ...(dto.documentNumber !== undefined
        ? { documentNumber: dto.documentNumber?.trim().toUpperCase() || null }
        : {}),
    },
    select: { id: true },
  });
}

function hasIdentityChanges(dto: UpdateReservationGuestDto): boolean {
  return [
    dto.fullName,
    dto.email,
    dto.phone,
    dto.documentType,
    dto.documentNumber,
  ].some((value) => value !== undefined);
}

export function toReadinessMember(row: PartyRow) {
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
