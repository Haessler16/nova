import { ReservationStatus, StayStatus } from '@prisma/client';

/**
 * Room moves reuse `POST /front-office/stays/:id/room-move`. The transactional
 * write remains the authority; this module only shares the eligibility
 * predicates with the read model that feeds the guided front-desk flow, so the
 * list of candidates cannot drift from the rules applied on confirmation.
 */
export type RoomMoveBlockerCode =
  | 'room_inactive'
  | 'room_out_of_service'
  | 'room_type_mismatch'
  | 'room_block_overlap'
  | 'room_occupied'
  | 'room_not_available';

export interface RoomMoveBlocker {
  code: RoomMoveBlockerCode;
  message: string;
}

const BLOCKER_MESSAGES: Record<RoomMoveBlockerCode, string> = {
  room_inactive: 'The selected room is not active.',
  room_out_of_service: 'The selected room is not operationally available.',
  room_type_mismatch: 'The selected room does not belong to the reservation room type.',
  room_block_overlap: 'The selected room has an active operational block.',
  room_occupied: 'The selected room already has an in-house stay.',
  room_not_available: 'The selected room has an overlapping reservation.',
};

export function roomMoveBlocker(code: RoomMoveBlockerCode): RoomMoveBlocker {
  return { code, message: BLOCKER_MESSAGES[code] };
}

/**
 * Checks that only depend on the destination room and the stay's room type.
 * Order matches the historical validation order in `moveRoom`, so the first
 * blocker is the same error the operator would get on confirmation.
 */
export function staticRoomMoveBlockers(
  room: { status: string; operationalState: string; roomTypeId: string },
  stayRoomTypeId: string,
): RoomMoveBlocker[] {
  const blockers: RoomMoveBlocker[] = [];
  if (room.status !== 'ACTIVE') {
    blockers.push(roomMoveBlocker('room_inactive'));
  }
  if (room.operationalState !== 'AVAILABLE') {
    blockers.push(roomMoveBlocker('room_out_of_service'));
  }
  if (room.roomTypeId !== stayRoomTypeId) {
    blockers.push(roomMoveBlocker('room_type_mismatch'));
  }
  return blockers;
}

type RoomIdFilter = string | { in: string[] };

export function activeRoomBlockWhere(scope: {
  organizationId: string;
  propertyId: string;
  roomId: RoomIdFilter;
  checkOutDate: Date;
  now: Date;
}) {
  return {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    roomId: scope.roomId,
    status: 'ACTIVE' as const,
    startsAt: { lt: scope.checkOutDate },
    endsAt: { gt: scope.now },
  };
}

export function occupyingStayWhere(scope: {
  organizationId: string;
  propertyId: string;
  roomId: RoomIdFilter;
  /** Exclude the stay being moved so it never blocks its current room. */
  stayId?: string;
}) {
  return {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    roomId: scope.roomId,
    status: StayStatus.IN_HOUSE,
    ...(scope.stayId === undefined ? {} : { id: { not: scope.stayId } }),
  };
}

export function overlappingReservationWhere(scope: {
  organizationId: string;
  propertyId: string;
  roomId: RoomIdFilter;
  reservation: { id: string; checkInDate: Date; checkOutDate: Date };
}) {
  return {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    roomId: scope.roomId,
    id: { not: scope.reservation.id },
    status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
    checkInDate: { lt: scope.reservation.checkOutDate },
    checkOutDate: { gt: scope.reservation.checkInDate },
  };
}

/**
 * Housekeeping does not block a move in the current rule set (the backend
 * allows it), but the operator must see it before confirming: sending a guest
 * into a dirty room is a real operational mistake.
 */
export function roomMoveWarnings(housekeepingState: string): Array<{
  code: 'housekeeping_not_ready';
  message: string;
}> {
  if (housekeepingState === 'CLEAN' || housekeepingState === 'INSPECTED') {
    return [];
  }
  return [
    {
      code: 'housekeeping_not_ready',
      message: 'The destination room is not marked as clean yet.',
    },
  ];
}
