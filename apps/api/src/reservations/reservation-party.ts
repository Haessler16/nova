import { GuestAgeGroup, MinorSupervision, ReservationGuestRole } from '@prisma/client';

export interface PartyMemberForReadiness {
  id: string | null;
  guestId: string;
  role: ReservationGuestRole;
  birthDate: Date | string | null;
  documentType: string | null;
  documentNumber: string | null;
  legalIncapacity: boolean;
  minorSupervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleReservationGuestId: string | null;
}

export interface PartyCounts {
  adults: number;
  minors: number;
  unknown: number;
}

export type PartyReadinessCode =
  | 'PRIMARY_MISSING'
  | 'GUEST_COUNT_MISMATCH'
  | 'AGE_GROUP_UNKNOWN'
  | 'PRIMARY_NOT_ADULT'
  | 'MINOR_RESPONSIBLE_MISSING'
  | 'MINOR_SUPERVISION_UNKNOWN'
  | 'MINOR_AUTHORIZATION_MISSING'
  | 'MINOR_AUTHORIZATION_REFERENCE_MISSING'
  | 'LEGAL_INCAPACITY_RESPONSIBLE_MISSING'
  | 'DOCUMENT_NOT_FNRH_READY'
  | 'PROFILE_INCOMPLETE';

export interface PartyReadiness {
  counts: PartyCounts;
  codes: PartyReadinessCode[];
  legalCodes: PartyReadinessCode[];
  checkInBlocked: boolean;
  fnrhReady: boolean;
}

const LEGAL_CODES: ReadonlySet<PartyReadinessCode> = new Set([
  'PRIMARY_NOT_ADULT',
  'MINOR_RESPONSIBLE_MISSING',
  'MINOR_SUPERVISION_UNKNOWN',
  'MINOR_AUTHORIZATION_MISSING',
  'MINOR_AUTHORIZATION_REFERENCE_MISSING',
  'LEGAL_INCAPACITY_RESPONSIBLE_MISSING',
]);

/** Calendar-date age at check-in, using UTC to avoid host timezone drift. */
export function ageAtCheckIn(birthDate: Date | string, checkInDate: Date | string): number {
  const birth = toUtcDate(birthDate);
  const checkIn = toUtcDate(checkInDate);
  const age = checkIn.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    checkIn.getUTCMonth() < birth.getUTCMonth() ||
    (checkIn.getUTCMonth() === birth.getUTCMonth() && checkIn.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

export function classifyAgeGroup(
  birthDate: Date | string | null,
  checkInDate: Date | string,
): GuestAgeGroup {
  if (birthDate === null) return GuestAgeGroup.UNKNOWN;
  return ageAtCheckIn(birthDate, checkInDate) >= 18 ? GuestAgeGroup.ADULT : GuestAgeGroup.MINOR;
}

export function effectiveAgeGroup(
  member: Pick<PartyMemberForReadiness, 'birthDate'>,
  checkInDate: Date | string,
): GuestAgeGroup {
  return classifyAgeGroup(member.birthDate, checkInDate);
}

export function partyCounts(
  members: PartyMemberForReadiness[],
  checkInDate: Date | string,
): PartyCounts {
  return members.reduce<PartyCounts>(
    (counts, member) => {
      const group = effectiveAgeGroup(member, checkInDate);
      if (group === GuestAgeGroup.MINOR) counts.minors += 1;
      else {
        // UNKNOWN is treated as an adult for operational capacity and for the
        // legacy reservation snapshot, but it still blocks FNRH readiness.
        counts.adults += 1;
        if (group === GuestAgeGroup.UNKNOWN) counts.unknown += 1;
      }
      return counts;
    },
    { adults: 0, minors: 0, unknown: 0 },
  );
}

export function evaluatePartyReadiness(input: {
  members: PartyMemberForReadiness[];
  checkInDate: Date | string;
  primaryGuestId?: string;
  declaredAdults: number;
  declaredChildren: number;
}): PartyReadiness {
  const counts = partyCounts(input.members, input.checkInDate);
  const codes = new Set<PartyReadinessCode>();

  for (const code of primaryCodes(input.members, input.checkInDate, input.primaryGuestId)) {
    codes.add(code);
  }

  if (counts.unknown > 0) {
    codes.add('AGE_GROUP_UNKNOWN');
  }
  if (counts.adults !== input.declaredAdults || counts.minors !== input.declaredChildren) {
    codes.add('GUEST_COUNT_MISMATCH');
  }

  const membersById = new Map(
    input.members
      .filter((member) => member.id !== null)
      .map((member) => [member.id as string, member]),
  );

  for (const member of input.members) {
    for (const code of memberCodes(member, membersById, input.checkInDate)) {
      codes.add(code);
    }
  }

  const allCodes = [...codes];
  const legalCodes = allCodes.filter((code) => LEGAL_CODES.has(code));
  return {
    counts,
    codes: allCodes,
    legalCodes,
    checkInBlocked: legalCodes.length > 0,
    fnrhReady: allCodes.length === 0,
  };
}

/** A reservation needs exactly one adult primary guest. */
function primaryCodes(
  members: PartyMemberForReadiness[],
  checkInDate: Date | string,
  primaryGuestId: string | undefined,
): PartyReadinessCode[] {
  const primary = members.find((member) => member.role === ReservationGuestRole.PRIMARY);
  if (
    primary === undefined ||
    (primaryGuestId !== undefined && primary.guestId !== primaryGuestId)
  ) {
    return ['PRIMARY_MISSING'];
  }

  const primaryGroup = effectiveAgeGroup(primary, checkInDate);
  return primaryGroup === GuestAgeGroup.MINOR || primary.legalIncapacity
    ? ['PRIMARY_NOT_ADULT']
    : [];
}

/** Per-member readiness: profile completeness, responsibility and FNRH document. */
function memberCodes(
  member: PartyMemberForReadiness,
  membersById: Map<string, PartyMemberForReadiness>,
  checkInDate: Date | string,
): PartyReadinessCode[] {
  const codes: PartyReadinessCode[] = [];
  const group = effectiveAgeGroup(member, checkInDate);

  if (group === GuestAgeGroup.UNKNOWN) {
    codes.push('PROFILE_INCOMPLETE');
    if (!isFnrhDocument(member.documentType, member.documentNumber)) {
      codes.push('DOCUMENT_NOT_FNRH_READY');
    }
    return codes;
  }

  if (group === GuestAgeGroup.ADULT) {
    if (member.legalIncapacity && !hasValidResponsible(member, membersById, checkInDate)) {
      codes.push('LEGAL_INCAPACITY_RESPONSIBLE_MISSING');
    }
    if (!isFnrhDocument(member.documentType, member.documentNumber)) {
      codes.push('DOCUMENT_NOT_FNRH_READY');
    }
    return codes;
  }

  if (!hasValidResponsible(member, membersById, checkInDate)) {
    codes.push('MINOR_RESPONSIBLE_MISSING');
  }
  codes.push(...minorSupervisionCodes(member));
  return codes;
}

function minorSupervisionCodes(member: PartyMemberForReadiness): PartyReadinessCode[] {
  if (member.minorSupervision === null || member.minorSupervision === MinorSupervision.UNKNOWN) {
    return ['MINOR_SUPERVISION_UNKNOWN'];
  }
  if (member.minorSupervision === MinorSupervision.UNACCOMPANIED_WITHOUT_AUTHORIZATION) {
    return ['MINOR_AUTHORIZATION_MISSING'];
  }
  if (
    member.minorSupervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED &&
    (member.authorizationReference === null || member.authorizationReference.trim() === '')
  ) {
    return ['MINOR_AUTHORIZATION_REFERENCE_MISSING'];
  }
  return [];
}

function hasValidResponsible(
  member: PartyMemberForReadiness,
  membersById: Map<string, PartyMemberForReadiness>,
  checkInDate: Date | string,
): boolean {
  if (member.responsibleReservationGuestId === null) return false;
  const responsible = membersById.get(member.responsibleReservationGuestId);
  if (responsible === undefined || responsible.id === member.id) return false;
  const group = effectiveAgeGroup(responsible, checkInDate);
  return group !== GuestAgeGroup.MINOR && !responsible.legalIncapacity;
}

function isFnrhDocument(documentType: string | null, documentNumber: string | null): boolean {
  return (
    (documentType === 'CPF' || documentType === 'PASSPORT') &&
    documentNumber !== null &&
    documentNumber.trim().length > 0
  );
}

function toUtcDate(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}
