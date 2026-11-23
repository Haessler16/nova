import { HousekeepingState, Prisma, RecordStatus, RoomOperationalState } from '@prisma/client';
import type { RoomAssignmentLease } from './room-assignment-leases.service';

export interface RoomResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  floor: string | null;
  building: string | null;
  attributes: string[];
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  status: RecordStatus;
  roomType: {
    id: string;
    name: string;
    code: string;
    capacityAdults: number;
    capacityChildren: number;
  };
  updatedBy: { id: string; name: string } | null;
  occupancy: 'VACANT' | 'OCCUPIED';
  currentStay: {
    id: string;
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  nextArrival: {
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
  } | null;
  activeBlock: { id: string; type: string; endsAt: Date } | null;
  lease: RoomAssignmentLease | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomListSummary {
  totalRooms: number;
  vacant: number;
  occupied: number;
  dirty: number;
  cleaning: number;
  clean: number;
  inspected: number;
  outOfOrder: number;
  outOfService: number;
}

export interface RoomListFacets {
  floors: string[];
  buildings: string[];
}

export interface RoomListResponse {
  items: RoomResponse[];
  nextCursor: string | null;
  summary: RoomListSummary;
  facets: RoomListFacets;
}

export interface RoomHistoryEntry {
  id: string;
  category: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  actorUserId: string | null;
  actorName: string | null;
  roomBlockId: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

export const ROOM_SELECT = Prisma.validator<Prisma.RoomSelect>()({
  id: true,
  organizationId: true,
  propertyId: true,
  roomTypeId: true,
  number: true,
  floor: true,
  building: true,
  attributes: true,
  housekeepingState: true,
  operationalState: true,
  status: true,
  roomType: {
    select: {
      id: true,
      name: true,
      code: true,
      capacityAdults: true,
      capacityChildren: true,
    },
  },
  updatedBy: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
});

export const ROOM_LIST_SELECT = Prisma.validator<Prisma.RoomSelect>()({
  ...ROOM_SELECT,
  stays: {
    where: { status: 'IN_HOUSE' },
    take: 1,
    select: {
      id: true,
      reservationId: true,
      guest: { select: { fullName: true } },
      reservation: {
        select: { code: true, checkInDate: true, checkOutDate: true },
      },
    },
  },
});

export type RoomListRow = Prisma.RoomGetPayload<{ select: typeof ROOM_LIST_SELECT }>;
