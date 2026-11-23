import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StayStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { requirePropertyContext, RoomStateService } from '../../inventory/room-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import { formatCalendarDate, nightsBetween } from '../../reservations/reservation-dates';
import { MoveStayRoomDto } from '../dto/front-office.dto';
import { lockRoomRow, lockStayRow } from '../infrastructure/row-locks';
import { groupOccupyingReservations, occupiedRoomIds, overlappingRoomIds } from '../room-occupancy';
import {
  activeRoomBlockWhere,
  occupyingStayWhere,
  overlappingReservationWhere,
  roomMoveBlocker,
  roomMoveWarnings,
  staticRoomMoveBlockers,
} from '../room-move';
import {
  mapStay,
  STAY_SELECT,
  type RoomMoveCandidate,
  type RoomMoveCandidates,
  type StayResponse,
  type StayRow,
  type Transaction,
} from './front-office.contracts';

const ROOM_MOVE_ROOM_SELECT = {
  id: true,
  number: true,
  floor: true,
  building: true,
  roomTypeId: true,
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
} as const;

type RoomMoveRoom = Prisma.RoomGetPayload<{ select: typeof ROOM_MOVE_ROOM_SELECT }>;

interface RoomMoveBlock {
  id: string;
  type: string;
  endsAt: Date;
}

interface DestinationAvailability {
  occupiedRooms: ReadonlySet<string>;
  overlappingRooms: ReadonlySet<string>;
  blockByRoom: ReadonlyMap<string, RoomMoveBlock>;
}

interface CandidateScope extends DestinationAvailability {
  stayRoomTypeId: string;
}

/**
 * Room moves share `POST /front-office/stays/:id/room-move`. The read model
 * lists destinations with the same eligibility rules the transactional move
 * applies, but only the confirmation inside a transaction writes anything.
 */
@Injectable()
export class RoomMoveUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly clock: Clock,
  ) {}

  /**
   * Read-only destination list for the guided room move. It exposes every room
   * of the property with the same eligibility rules the transactional move
   * applies, so the operator can see why a room is not selectable before
   * submitting the change. It never reserves a room.
   */
  async candidates(context: TenantContext, stayId: string): Promise<RoomMoveCandidates> {
    const propertyId = requirePropertyContext(context);
    const stay = await this.loadInHouseStay(context, propertyId, stayId);
    const rooms = await this.prisma.room.findMany({
      where: { organizationId: context.organizationId, propertyId },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
      select: ROOM_MOVE_ROOM_SELECT,
    });
    const currentRoom = rooms.find((room) => room.id === stay.roomId);
    if (currentRoom === undefined) {
      throw new ConflictException({
        code: 'stay_inconsistent',
        message: 'The stay references a room that is not available in the property.',
      });
    }

    const destinations = rooms.filter((room) => room.id !== stay.roomId);
    const availability = await this.loadAvailability(context, propertyId, destinations, stay);
    const scope: CandidateScope = { ...availability, stayRoomTypeId: stay.reservation.roomType.id };

    return {
      stay: buildStayView(stay, currentRoom),
      candidates: destinations.map((room) => buildCandidate(room, scope)),
    };
  }

  async execute(
    context: TenantContext,
    stayId: string,
    dto: MoveStayRoomDto,
  ): Promise<StayResponse> {
    const propertyId = requirePropertyContext(context);
    const reason = dto.reason?.trim() ?? 'Room move.';

    return this.prisma.$transaction(async (transaction) => {
      const stay = await lockStayRow(transaction, {
        organizationId: context.organizationId,
        propertyId,
        id: stayId,
      });

      if (stay.status !== StayStatus.IN_HOUSE) {
        throw new ConflictException({
          code: 'stay_not_in_house',
          message: 'Only in-house stays can change rooms.',
          details: { status: stay.status },
        });
      }

      if (stay.roomId === dto.roomId) {
        return mapStay(stay);
      }

      const room = await lockRoomRow(this.roomState, transaction, {
        organizationId: context.organizationId,
        propertyId,
        id: dto.roomId,
      });

      await this.assertDestinationFree(transaction, context, propertyId, stay, room);

      const updated = await transaction.stay.update({
        where: { id: stay.id },
        data: {
          roomId: room.id,
          moveCount: { increment: 1 },
        },
        select: STAY_SELECT,
      });

      await transaction.reservation.update({
        where: { id: stay.reservationId },
        data: { roomId: room.id },
        select: { id: true },
      });

      await this.recordMove(transaction, context, propertyId, stay, room, reason);

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'reservation.room_moved',
          entityType: 'Reservation',
          entityId: stay.reservationId,
          correlationId: context.correlationId,
          reason,
          metadata: {
            code: stay.reservation.code,
            stayId: stay.id,
            fromRoomId: stay.roomId,
            toRoomId: room.id,
            fromRoomNumber: stay.room.number,
            toRoomNumber: room.number,
          },
        },
        transaction,
      );

      return mapStay(updated);
    });
  }

  private async loadInHouseStay(
    context: TenantContext,
    propertyId: string,
    stayId: string,
  ): Promise<StayRow> {
    const stay = await this.prisma.stay.findFirst({
      where: { id: stayId, organizationId: context.organizationId, propertyId },
      select: STAY_SELECT,
    });
    if (stay === null) {
      throw new NotFoundException({
        code: 'stay_not_found',
        message: 'Stay not found in the selected property.',
      });
    }
    // Same rule as the transactional move: a stay that is no longer in house
    // cannot change rooms, so the read model must not offer destinations for
    // it. Otherwise a stale tab lists eligible rooms that can never succeed.
    if (stay.status !== StayStatus.IN_HOUSE) {
      throw new ConflictException({
        code: 'stay_not_in_house',
        message: 'Only in-house stays can change rooms.',
        details: { status: stay.status },
      });
    }
    return stay;
  }

  private async loadAvailability(
    context: TenantContext,
    propertyId: string,
    destinations: RoomMoveRoom[],
    stay: StayRow,
  ): Promise<DestinationAvailability> {
    const roomIds = destinations.map((room) => room.id);
    const now = this.clock.now();
    const [occupyingStays, blocks, overlapping] = await Promise.all([
      this.prisma.stay.findMany({
        where: occupyingStayWhere({
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
        }),
        select: { roomId: true, reservationId: true },
      }),
      this.prisma.roomBlock.findMany({
        where: activeRoomBlockWhere({
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          checkOutDate: stay.reservation.checkOutDate,
          now,
        }),
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        select: { id: true, roomId: true, type: true, endsAt: true },
      }),
      this.prisma.reservation.findMany({
        where: overlappingReservationWhere({
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          reservation: stay.reservation,
        }),
        select: { id: true, roomId: true },
      }),
    ]);

    // Occupied rooms report their own in-house reservation once; see
    // `room-occupancy.ts` for the shared rule with the check-in readiness.
    const occupyingReservations = groupOccupyingReservations(occupyingStays);
    const blockByRoom = new Map<string, RoomMoveBlock>();
    for (const block of blocks) {
      if (!blockByRoom.has(block.roomId)) {
        blockByRoom.set(block.roomId, block);
      }
    }

    return {
      occupiedRooms: occupiedRoomIds(occupyingReservations),
      overlappingRooms: overlappingRoomIds(overlapping, occupyingReservations),
      blockByRoom,
    };
  }

  private async assertDestinationFree(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    stay: StayRow,
    room: { id: string; status: string; operationalState: string; roomTypeId: string },
  ): Promise<void> {
    const [staticBlocker] = staticRoomMoveBlockers(room, stay.reservation.roomType.id);
    if (staticBlocker !== undefined) {
      throw new ConflictException({
        code: staticBlocker.code,
        message: staticBlocker.message,
      });
    }

    const blocking = await transaction.roomBlock.findFirst({
      where: activeRoomBlockWhere({
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        checkOutDate: stay.reservation.checkOutDate,
        now: this.clock.now(),
      }),
      select: { id: true, type: true },
    });
    if (blocking !== null) {
      throw new ConflictException({
        code: 'room_block_overlap',
        message: 'The selected room has an active operational block.',
        details: { blockId: blocking.id, type: blocking.type },
      });
    }

    const occupied = await transaction.stay.findFirst({
      where: occupyingStayWhere({
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        stayId: stay.id,
      }),
      select: { id: true, reservationId: true },
    });
    if (occupied !== null) {
      throw new ConflictException({
        code: 'room_occupied',
        message: 'The selected room already has an in-house stay.',
        details: { stayId: occupied.id },
      });
    }

    const overlap = await transaction.reservation.findFirst({
      where: overlappingReservationWhere({
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        reservation: stay.reservation,
      }),
      select: { id: true, code: true },
    });
    if (overlap !== null) {
      throw new ConflictException({
        code: 'room_not_available',
        message: 'The selected room has an overlapping reservation.',
        details: { reservationId: overlap.id, code: overlap.code },
      });
    }
  }

  private async recordMove(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    stay: StayRow,
    room: { id: string },
    reason: string,
  ): Promise<void> {
    await transaction.reservationHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: stay.reservationId,
        action: 'reservation.room_moved',
        fromStatus: stay.reservation.status,
        toStatus: stay.reservation.status,
        fromRoomId: stay.roomId,
        toRoomId: room.id,
        reason,
        actorUserId: context.actor.id,
        correlationId: context.correlationId,
      },
      select: { id: true },
    });
  }
}

function buildStayView(stay: StayRow, currentRoom: RoomMoveRoom): RoomMoveCandidates['stay'] {
  return {
    id: stay.id,
    status: stay.status,
    room: {
      id: currentRoom.id,
      number: currentRoom.number,
      floor: currentRoom.floor,
      building: currentRoom.building,
      housekeepingState: currentRoom.housekeepingState,
      roomType: currentRoom.roomType,
    },
    guest: { id: stay.guest.id, fullName: stay.guest.fullName },
    reservation: {
      id: stay.reservation.id,
      code: stay.reservation.code,
      status: stay.reservation.status,
      checkInDate: formatCalendarDate(stay.reservation.checkInDate),
      checkOutDate: formatCalendarDate(stay.reservation.checkOutDate),
      nights: nightsBetween(stay.reservation.checkInDate, stay.reservation.checkOutDate),
      adults: stay.reservation.adults,
      children: stay.reservation.children,
    },
  };
}

function buildCandidate(room: RoomMoveRoom, scope: CandidateScope): RoomMoveCandidate {
  const blockers = staticRoomMoveBlockers(room, scope.stayRoomTypeId);
  if (scope.blockByRoom.has(room.id)) {
    blockers.push(roomMoveBlocker('room_block_overlap'));
  }
  if (scope.occupiedRooms.has(room.id)) {
    blockers.push(roomMoveBlocker('room_occupied'));
  }
  if (scope.overlappingRooms.has(room.id)) {
    blockers.push(roomMoveBlocker('room_not_available'));
  }
  const block = scope.blockByRoom.get(room.id);
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    building: room.building,
    roomType: room.roomType,
    housekeepingState: room.housekeepingState,
    operationalState: room.operationalState,
    occupancy: scope.occupiedRooms.has(room.id) ? 'OCCUPIED' : 'VACANT',
    activeBlock:
      block === undefined ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
    eligible: blockers.length === 0,
    blockers,
    warnings: roomMoveWarnings(room.housekeepingState),
  };
}
