import { Prisma } from '@prisma/client';
import { formatCalendarDate } from '../reservations/reservation-dates';
import type { RoomAssignmentLease } from './room-assignment-leases.service';
import {
  ROOM_SELECT,
  type RoomListRow,
  type RoomResponse,
} from './rooms.contracts';

export function mapRoom(
  room: RoomListRow,
  lease: RoomAssignmentLease | null,
  block: { id: string; type: string; endsAt: Date } | null,
  next: { id: string; code: string; checkInDate: Date; guest: { fullName: string } } | null,
): RoomResponse {
  const stay = room.stays[0];

  return {
    id: room.id,
    organizationId: room.organizationId,
    propertyId: room.propertyId,
    roomTypeId: room.roomTypeId,
    number: room.number,
    floor: room.floor,
    building: room.building,
    attributes: room.attributes,
    housekeepingState: room.housekeepingState,
    operationalState: room.operationalState,
    status: room.status,
    roomType: room.roomType,
    updatedBy: room.updatedBy,
    occupancy: stay === undefined ? 'VACANT' : 'OCCUPIED',
    currentStay:
      stay === undefined
        ? null
        : {
            id: stay.id,
            reservationId: stay.reservationId,
            code: stay.reservation.code,
            guestName: stay.guest.fullName,
            checkInDate: formatCalendarDate(stay.reservation.checkInDate),
            checkOutDate: formatCalendarDate(stay.reservation.checkOutDate),
          },
    nextArrival:
      next === null
        ? null
        : {
            reservationId: next.id,
            code: next.code,
            guestName: next.guest.fullName,
            checkInDate: formatCalendarDate(next.checkInDate),
          },
    activeBlock: block === null ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
    lease,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

/** A freshly written room has no stay, block, arrival or lease yet. */
export function withEmptyRelations(
  room: Prisma.RoomGetPayload<{ select: typeof ROOM_SELECT }>,
): RoomResponse {
  return {
    ...room,
    occupancy: 'VACANT',
    currentStay: null,
    nextArrival: null,
    activeBlock: null,
    lease: null,
  };
}
