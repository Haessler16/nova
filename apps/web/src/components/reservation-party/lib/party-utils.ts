import type {
  GuestDocumentType,
  MinorSupervision,
  ReservationParty as ReservationPartyResponse,
  ReservationPartyMember,
} from '@/lib/types';

export interface EditorState {
  kind: 'adult' | 'minor';
  member: ReservationPartyMember | null;
}

export interface EditorForm {
  guestId: string | null;
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
  responsibleReservationGuestId: string;
  minorSupervision: MinorSupervision;
  authorizationReference: string;
}

export function formFromMember(editor: EditorState, party: ReservationPartyResponse): EditorForm {
  const member = editor.member;
  return {
    guestId: member?.guestId ?? null,
    fullName: member?.fullName ?? '',
    birthDate: member?.birthDate ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    documentType: member?.documentType ?? '',
    documentNumber: member?.documentNumber ?? '',
    responsibleReservationGuestId:
      member?.responsibleReservationGuestId ?? party.primary?.reservationGuestId ?? '',
    minorSupervision: member?.minorSupervision ?? 'ACCOMPANIED',
    authorizationReference: member?.authorizationReference ?? '',
  };
}

export function isMember(member: ReservationPartyMember | null): member is ReservationPartyMember {
  return member !== null;
}

export function maskDocument(member: ReservationPartyMember): string {
  if (!member.documentNumber) return '';
  if (member.documentType === 'CPF') {
    const digits = member.documentNumber.replace(/\D/g, '');
    return `•••.${digits.slice(-6, -2)}-${digits.slice(-2)}`;
  }
  if (member.documentType === 'PASSPORT') return `••••${member.documentNumber.slice(-4)}`;
  return member.documentNumber;
}

export function ageAtCheckIn(birthDate: string, checkInDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const checkIn = new Date(`${checkInDate}T00:00:00Z`);
  const age = checkIn.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    checkIn.getUTCMonth() < birth.getUTCMonth() ||
    (checkIn.getUTCMonth() === birth.getUTCMonth() && checkIn.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}
