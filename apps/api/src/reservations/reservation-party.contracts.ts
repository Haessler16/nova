import {
  GuestAgeGroup,
  GuestDocumentType,
  MinorSupervision,
  Prisma,
  ReservationGuestRole,
  ReservationStatus,
} from '@prisma/client';

export const PARTY_GUEST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  documentType: true,
  documentNumber: true,
  fnrhProfile: { select: { birthDate: true } },
} as const;

export const PARTY_RESERVATION_SELECT = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  organizationId: true,
  propertyId: true,
  code: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  guestId: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  roomType: { select: { capacityAdults: true, capacityChildren: true } },
  guests: {
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      reservationId: true,
      guestId: true,
      role: true,
      ageGroup: true,
      legalIncapacity: true,
      minorSupervision: true,
      authorizationReference: true,
      origin: true,
      responsibleReservationGuestId: true,
      guest: { select: PARTY_GUEST_SELECT },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
});

export type PartyReservationRow = Prisma.ReservationGetPayload<{
  select: typeof PARTY_RESERVATION_SELECT;
}>;
export type PartyRow = PartyReservationRow['guests'][number];
export type PartyMemberRow = {
  id: string | null;
  guestId: string;
  role: ReservationGuestRole;
  legalIncapacity: boolean;
  minorSupervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleReservationGuestId: string | null;
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    documentType: GuestDocumentType | null;
    documentNumber: string | null;
    fnrhProfile: { birthDate: Date | null } | null;
  };
};
export type Transaction = Prisma.TransactionClient;

export interface ReservationPartyMemberResponse {
  reservationGuestId: string | null;
  guestId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  birthDate: string | null;
  ageAtCheckIn: number | null;
  ageGroup: GuestAgeGroup;
  role: ReservationGuestRole;
  legalIncapacity: boolean;
  minorSupervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleReservationGuestId: string | null;
  responsibleName: string | null;
}

export interface ReservationPartyResponse {
  reservationId: string;
  code: string;
  status: ReservationStatus;
  primary: ReservationPartyMemberResponse | null;
  companions: ReservationPartyMemberResponse[];
  summary: {
    adults: number;
    minors: number;
    unknown: number;
    declaredAdults: number;
    declaredChildren: number;
  };
  readiness: {
    checkIn: 'ALLOWED' | 'BLOCKED';
    fnrh: 'READY' | 'INCOMPLETE' | 'BLOCKED';
    codes: string[];
    legalCodes: string[];
  };
}
