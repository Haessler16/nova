import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HousekeepingState,
  ReservationStatus,
  RoomOperationalState,
  StayStatus,
} from '@prisma/client';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { RoomAssignmentLeasesService } from '../../inventory/room-assignment-leases.service';
import { requirePropertyContext, RoomStateService } from '../../inventory/room-state.service';
import { computeOperationalDay } from '../../operational-day/operational-day';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCheckInWindow, CHECK_IN_BLOCKED_HOUSEKEEPING_STATES } from '../check-in';
import { PropertyLoader } from '../infrastructure/property-loader';
import { groupOccupyingReservations, occupiedRoomIds, overlappingRoomIds } from '../room-occupancy';
import {
  mapReservationSummary,
  RESERVATION_SUMMARY_SELECT,
  type CheckInReadiness,
  type CheckInRoomOption,
  type ReservationSummaryRow,
} from './front-office.contracts';

interface RoomCandidate {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
}

/**
 * Read-only check-in checklist for the guided front-desk flow. It mirrors the
 * rules `CheckInUseCase.execute` applies so the operator sees why a room is not
 * selectable, but the confirmation transaction remains the authority.
 */
@Injectable()
export class CheckInReadinessQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly clock: Clock,
    private readonly properties: PropertyLoader,
  ) {}

  async readiness(context: TenantContext, reservationId: string): Promise<CheckInReadiness> {
    const propertyId = requirePropertyContext(context);
    const property = await this.properties.load(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const reservation = await this.loadReservation(context, propertyId, reservationId);
    const rooms = await this.loadCandidateRooms(context, propertyId, reservation);
    const checkInWindow = buildCheckInWindow(
      operationalDay.localDate,
      reservation.checkInDate,
      reservation.checkOutDate,
    );
    const options = await this.evaluateRoomOptions(context, propertyId, reservation, rooms);
    const current = options.find((room) => room.id === reservation.roomId);

    return {
      reservation: mapReservationSummary(reservation),
      checkInWindow,
      currentRoomId: reservation.roomId,
      currentRoomEligible: reservation.roomId === null ? null : current?.eligible === true,
      rooms: options,
    };
  }

  private async loadReservation(
    context: TenantContext,
    propertyId: string,
    reservationId: string,
  ): Promise<ReservationSummaryRow> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: RESERVATION_SUMMARY_SELECT,
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }
    return reservation;
  }

  private async loadCandidateRooms(
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
  ): Promise<RoomCandidate[]> {
    return this.prisma.room.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        status: 'ACTIVE',
        roomTypeId: reservation.roomTypeId,
      },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        number: true,
        floor: true,
        building: true,
        housekeepingState: true,
        operationalState: true,
      },
    });
  }

  private async evaluateRoomOptions(
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
    rooms: RoomCandidate[],
  ): Promise<CheckInRoomOption[]> {
    const roomIds = rooms.map((room) => room.id);
    const [stays, blocks, overlapping] = await Promise.all([
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: StayStatus.IN_HOUSE,
        },
        select: { roomId: true, reservationId: true },
      }),
      this.prisma.roomBlock.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: 'ACTIVE',
          startsAt: { lt: reservation.checkOutDate },
          endsAt: { gt: reservation.checkInDate },
        },
        select: { id: true, roomId: true, type: true, endsAt: true },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          id: { not: reservation.id },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
          checkInDate: { lt: reservation.checkOutDate },
          checkOutDate: { gt: reservation.checkInDate },
        },
        select: { id: true, roomId: true },
      }),
    ]);

    const occupyingReservations = groupOccupyingReservations(stays);
    const occupiedRooms = occupiedRoomIds(occupyingReservations);
    const overlappingRooms = overlappingRoomIds(overlapping, occupyingReservations);
    const blockByRoom = new Map<string, (typeof blocks)[number]>();
    for (const block of blocks) {
      if (!blockByRoom.has(block.roomId)) {
        blockByRoom.set(block.roomId, block);
      }
    }

    const leases = await this.leases.getMany(context, roomIds);

    return rooms.map((room) => {
      const reasons: string[] = [];
      if (room.operationalState !== RoomOperationalState.AVAILABLE) {
        reasons.push('ROOM_OUT_OF_SERVICE');
      }
      if (blockByRoom.has(room.id)) {
        reasons.push('ROOM_BLOCKED');
      }
      if (occupiedRooms.has(room.id)) {
        reasons.push('ROOM_OCCUPIED');
      }
      if (overlappingRooms.has(room.id)) {
        reasons.push('ROOM_NOT_AVAILABLE');
      }
      if (CHECK_IN_BLOCKED_HOUSEKEEPING_STATES.includes(room.housekeepingState)) {
        reasons.push('HOUSEKEEPING_NOT_READY');
      }
      const block = blockByRoom.get(room.id);
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        building: room.building,
        housekeepingState: room.housekeepingState,
        operationalState: room.operationalState,
        occupancy: occupiedRooms.has(room.id) ? 'OCCUPIED' : 'VACANT',
        activeBlock:
          block === undefined ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
        lease: leases.get(room.id) ?? null,
        eligible: reasons.length === 0,
        reasons,
      };
    });
  }
}
