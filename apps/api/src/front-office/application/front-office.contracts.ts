import {
  HousekeepingState,
  Prisma,
  ReservationStatus,
  RoomOperationalState,
  StayStatus,
} from '@prisma/client';
import type { RoomAssignmentLease } from '../../inventory/room-assignment-leases.service';
import { formatCalendarDate, nightsBetween } from '../../reservations/reservation-dates';

export type Transaction = Prisma.TransactionClient;

export const RESERVATION_SUMMARY_SELECT = {
  id: true,
  code: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  notes: true,
  roomId: true,
  guestId: true,
  roomTypeId: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  roomType: { select: { id: true, name: true, code: true } },
  room: { select: { id: true, number: true, floor: true, building: true } },
} as const;

export const STAY_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  guestId: true,
  roomId: true,
  status: true,
  checkedInAt: true,
  checkedOutAt: true,
  checkOutNotes: true,
  moveCount: true,
  createdAt: true,
  updatedAt: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  room: { select: { id: true, number: true, floor: true, building: true } },
  reservation: {
    select: {
      id: true,
      code: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      adults: true,
      children: true,
      notes: true,
      roomType: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

export type ReservationSummaryRow = Prisma.ReservationGetPayload<{
  select: typeof RESERVATION_SUMMARY_SELECT;
}>;
export type StayRow = Prisma.StayGetPayload<{ select: typeof STAY_SELECT }>;

export interface ReservationSummaryResponse {
  id: string;
  code: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  notes: string | null;
  roomId: string | null;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  roomType: { id: string; name: string; code: string };
  room: { id: string; number: string; floor: string | null; building: string | null } | null;
}

export interface StayResponse {
  id: string;
  status: StayStatus;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkOutNotes: string | null;
  moveCount: number;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  room: { id: string; number: string; floor: string | null; building: string | null };
  reservation: {
    id: string;
    code: string;
    status: ReservationStatus;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    notes: string | null;
    roomType: { id: string; name: string; code: string };
  };
}

export interface CheckInRoomOption {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  occupancy: 'VACANT' | 'OCCUPIED';
  activeBlock: { id: string; type: string; endsAt: Date } | null;
  lease: RoomAssignmentLease | null;
  eligible: boolean;
  reasons: string[];
}

export interface CheckInWindow {
  localDate: string;
  checkInDate: string;
  checkOutDate: string;
  allowed: boolean;
  code: 'check_in_too_early' | 'check_in_window_elapsed' | null;
}

export interface CheckInReadiness {
  reservation: ReservationSummaryResponse;
  checkInWindow: CheckInWindow;
  currentRoomId: string | null;
  currentRoomEligible: boolean | null;
  rooms: CheckInRoomOption[];
}

export function mapReservationSummary(row: ReservationSummaryRow): ReservationSummaryResponse {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    checkInDate: formatCalendarDate(row.checkInDate),
    checkOutDate: formatCalendarDate(row.checkOutDate),
    nights: nightsBetween(row.checkInDate, row.checkOutDate),
    adults: row.adults,
    children: row.children,
    notes: row.notes,
    roomId: row.roomId,
    guest: row.guest,
    roomType: row.roomType,
    room: row.room,
  };
}

export function mapStay(row: StayRow): StayResponse {
  return {
    id: row.id,
    status: row.status,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    checkOutNotes: row.checkOutNotes,
    moveCount: row.moveCount,
    guest: row.guest,
    room: row.room,
    reservation: {
      id: row.reservation.id,
      code: row.reservation.code,
      status: row.reservation.status,
      checkInDate: formatCalendarDate(row.reservation.checkInDate),
      checkOutDate: formatCalendarDate(row.reservation.checkOutDate),
      nights: nightsBetween(row.reservation.checkInDate, row.reservation.checkOutDate),
      adults: row.reservation.adults,
      children: row.reservation.children,
      notes: row.reservation.notes,
      roomType: row.reservation.roomType,
    },
  };
}
