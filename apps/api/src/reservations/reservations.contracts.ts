import { Prisma, ReservationStatus } from '@prisma/client';
import { formatCalendarDate, nightsBetween } from './reservation-dates';

export interface ReservationResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  code: string;
  status: ReservationStatus;
  source: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  guestId: string;
  roomTypeId: string;
  roomId: string | null;
  notes: string | null;
  idempotencyKey: string | null;
  createdByUserId: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  roomType: { id: string; name: string; code: string };
  room: { id: string; number: string; floor: string | null; building: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservationAvailabilityItem {
  roomId: string;
  number: string;
  floor: string | null;
  building: string | null;
  roomTypeId: string;
  roomType: { name: string; code: string };
}

export interface ReservationHistoryEntry {
  id: string;
  action: string;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus | null;
  fromRoomId: string | null;
  toRoomId: string | null;
  reason: string | null;
  actorUserId: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

export const RESERVATION_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  code: true,
  status: true,
  source: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  guestId: true,
  roomTypeId: true,
  roomId: true,
  notes: true,
  idempotencyKey: true,
  createdByUserId: true,
  cancelledAt: true,
  cancellationReason: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  roomType: { select: { id: true, name: true, code: true } },
  room: { select: { id: true, number: true, floor: true, building: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;
export type Transaction = Prisma.TransactionClient;

export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export function mapReservation(row: ReservationRow): ReservationResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    propertyId: row.propertyId,
    code: row.code,
    status: row.status,
    source: row.source,
    checkInDate: formatCalendarDate(row.checkInDate),
    checkOutDate: formatCalendarDate(row.checkOutDate),
    nights: nightsBetween(row.checkInDate, row.checkOutDate),
    adults: row.adults,
    children: row.children,
    guestId: row.guestId,
    roomTypeId: row.roomTypeId,
    roomId: row.roomId,
    notes: row.notes,
    idempotencyKey: row.idempotencyKey,
    createdByUserId: row.createdByUserId,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    guest: row.guest,
    roomType: row.roomType,
    room: row.room,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
