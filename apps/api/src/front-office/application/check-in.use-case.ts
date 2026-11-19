import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HousekeepingState,
  Prisma,
  ReservationStatus,
  RoomOperationalState,
  StayStatus,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { RoomAssignmentLeasesService } from '../../inventory/room-assignment-leases.service';
import { requirePropertyContext, RoomStateService } from '../../inventory/room-state.service';
import { computeOperationalDay } from '../../operational-day/operational-day';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluatePartyReadiness } from '../../reservations/reservation-party';
import { buildCheckInWindow, CHECK_IN_BLOCKED_HOUSEKEEPING_STATES } from '../check-in';
import {
  lockReservationRow,
  lockRoomRow,
  type RoomLockRow,
  type Transaction,
} from '../infrastructure/row-locks';
import { PropertyLoader } from '../infrastructure/property-loader';
import { groupOccupyingReservations, occupiedRoomIds, overlappingRoomIds } from '../room-occupancy';
import {
  mapReservationSummary,
  mapStay,
  RESERVATION_SUMMARY_SELECT,
  STAY_SELECT,
  type CheckInReadiness,
  type CheckInRoomOption,
  type ReservationSummaryResponse,
  type ReservationSummaryRow,
  type StayResponse,
  type StayRow,
} from './front-office.contracts';

interface RoomCandidate {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
}

interface OperationalDayView {
  localDate: string;
  operationalDate: string;
}

@Injectable()
export class CheckInUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly clock: Clock,
    private readonly properties: PropertyLoader,
  ) {}

  /**
   * Read-only check-in checklist for the guided front-desk flow. It mirrors the
   * backend rules used by `execute` so the operator sees why a room is not
   * selectable, but the confirmation transaction remains the authority.
   */
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

  async execute(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ reservation: ReservationSummaryResponse; stay: StayResponse }> {
    const propertyId = requirePropertyContext(context);
    const property = await this.properties.load(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await lockReservationRow(transaction, {
          organizationId: context.organizationId,
          propertyId,
          id: reservationId,
        });

        const replay = await this.replayIfCheckedIn(transaction, reservation);
        if (replay !== null) {
          return replay;
        }

        const roomId = this.assertEligible(reservation, operationalDay);
        await this.assertPartyReady(transaction, context, propertyId, reservation);

        // One clock read for the whole transaction: the block window and the
        // stay timestamp must agree.
        const now = this.clock.now();
        const room = await this.ensureRoomAssignable(transaction, context, propertyId, roomId, now);
        const stay = await this.createStay(
          transaction,
          context,
          propertyId,
          reservation,
          room,
          now,
        );
        const updated = await this.markReservationCheckedIn(
          transaction,
          context,
          propertyId,
          reservation,
          room,
        );
        await this.appendCheckInAudit(
          transaction,
          context,
          propertyId,
          reservation,
          stay,
          room,
          operationalDay,
        );

        return { reservation: mapReservationSummary(updated), stay: mapStay(stay) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.stay.findUnique({
          where: { reservationId },
          select: STAY_SELECT,
        });
        if (existing !== null) {
          return {
            reservation: mapReservationSummary(
              await this.prisma.reservation.findFirstOrThrow({
                where: { id: reservationId },
                select: RESERVATION_SUMMARY_SELECT,
              }),
            ),
            stay: mapStay(existing),
          };
        }
        throw new ConflictException({
          code: 'stay_conflict',
          message: 'A stay already exists for this reservation.',
        });
      }
      throw error;
    }
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

  /** Repeating a check-in that already happened returns the existing stay. */
  private async replayIfCheckedIn(
    transaction: Transaction,
    reservation: ReservationSummaryRow,
  ): Promise<{ reservation: ReservationSummaryResponse; stay: StayResponse } | null> {
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      return null;
    }
    const existing = await transaction.stay.findUnique({
      where: { reservationId: reservation.id },
      select: STAY_SELECT,
    });
    if (existing === null) {
      throw new ConflictException({
        code: 'stay_inconsistent',
        message: 'Reservation is checked in but has no stay record.',
      });
    }
    return { reservation: mapReservationSummary(reservation), stay: mapStay(existing) };
  }

  /**
   * Rejects an ineligible reservation and returns its assigned room id, so the
   * caller keeps the narrowed value instead of re-asserting it.
   */
  private assertEligible(
    reservation: ReservationSummaryRow,
    operationalDay: OperationalDayView,
  ): string {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'reservation_not_check_in_eligible',
        message: 'Only confirmed reservations can be checked in.',
        details: { status: reservation.status },
      });
    }

    // Check-in follows the local calendar date, not the operational day:
    // an early-morning arrival is still arriving on that calendar date.
    const checkInWindow = buildCheckInWindow(
      operationalDay.localDate,
      reservation.checkInDate,
      reservation.checkOutDate,
    );
    if (checkInWindow.code === 'check_in_too_early') {
      throw new ConflictException({
        code: checkInWindow.code,
        message: 'The reservation cannot be checked in before its arrival date.',
        details: {
          checkInDate: checkInWindow.checkInDate,
          localDate: checkInWindow.localDate,
        },
      });
    }
    if (checkInWindow.code === 'check_in_window_elapsed') {
      throw new ConflictException({
        code: checkInWindow.code,
        message: 'The reservation check-in window has elapsed.',
        details: {
          checkOutDate: checkInWindow.checkOutDate,
          localDate: checkInWindow.localDate,
        },
      });
    }

    if (reservation.roomId === null) {
      throw new ConflictException({
        code: 'reservation_room_required',
        message: 'Assign a room to the reservation before checking in.',
      });
    }

    return reservation.roomId;
  }

  private async assertPartyReady(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
  ): Promise<void> {
    const party = await transaction.reservationGuest.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
      },
      select: {
        id: true,
        guestId: true,
        role: true,
        legalIncapacity: true,
        minorSupervision: true,
        authorizationReference: true,
        responsibleReservationGuestId: true,
        guest: {
          select: {
            documentType: true,
            documentNumber: true,
            fnrhProfile: { select: { birthDate: true } },
          },
        },
      },
    });
    if (party.length === 0) {
      return;
    }

    const readiness = evaluatePartyReadiness({
      members: party.map((row) => ({
        id: row.id,
        guestId: row.guestId,
        role: row.role,
        birthDate: row.guest.fnrhProfile?.birthDate ?? null,
        documentType: row.guest.documentType,
        documentNumber: row.guest.documentNumber,
        legalIncapacity: row.legalIncapacity,
        minorSupervision: row.minorSupervision,
        authorizationReference: row.authorizationReference,
        responsibleReservationGuestId: row.responsibleReservationGuestId,
      })),
      checkInDate: reservation.checkInDate,
      primaryGuestId: reservation.guestId,
      declaredAdults: reservation.adults,
      declaredChildren: reservation.children,
    });
    if (readiness.checkInBlocked) {
      throw new ConflictException({
        code: 'reservation_party_check_in_blocked',
        message: 'Resolve the reservation party legal block before checking in.',
        details: { codes: readiness.legalCodes },
      });
    }
  }

  private async ensureRoomAssignable(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    roomId: string,
    now: Date,
  ): Promise<RoomLockRow> {
    const room = await lockRoomRow(this.roomState, transaction, {
      organizationId: context.organizationId,
      propertyId,
      id: roomId,
    });

    if (room.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'room_inactive',
        message: 'The assigned room is not active.',
      });
    }
    if (room.operationalState !== 'AVAILABLE') {
      throw new ConflictException({
        code: 'room_out_of_service',
        message: 'The assigned room is not operationally available.',
        details: { operationalState: room.operationalState },
      });
    }
    if (CHECK_IN_BLOCKED_HOUSEKEEPING_STATES.includes(room.housekeepingState)) {
      throw new ConflictException({
        code: 'room_housekeeping_not_ready',
        message: 'The assigned room is not clean enough for check-in.',
        details: { housekeepingState: room.housekeepingState },
      });
    }

    const blocking = await transaction.roomBlock.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { id: true, type: true, endsAt: true },
    });
    if (blocking !== null) {
      throw new ConflictException({
        code: 'room_out_of_service',
        message: 'The assigned room has an active operational block.',
        details: {
          blockId: blocking.id,
          type: blocking.type,
          endsAt: blocking.endsAt,
        },
      });
    }

    const occupied = await transaction.stay.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        status: StayStatus.IN_HOUSE,
      },
      select: { id: true, reservationId: true },
    });
    if (occupied !== null) {
      throw new ConflictException({
        code: 'room_occupied',
        message: 'The room already has an in-house stay.',
        details: { stayId: occupied.id, reservationId: occupied.reservationId },
      });
    }

    return room;
  }

  private async createStay(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
    room: RoomLockRow,
    now: Date,
  ): Promise<StayRow> {
    return transaction.stay.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        roomId: room.id,
        status: StayStatus.IN_HOUSE,
        checkedInAt: now,
        checkedInByUserId: context.actor.id,
      },
      select: STAY_SELECT,
    });
  }

  private async markReservationCheckedIn(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
    room: RoomLockRow,
  ): Promise<ReservationSummaryRow> {
    const updated = await transaction.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CHECKED_IN },
      select: RESERVATION_SUMMARY_SELECT,
    });

    await transaction.reservationHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
        action: 'reservation.checked_in',
        fromStatus: ReservationStatus.CONFIRMED,
        toStatus: ReservationStatus.CHECKED_IN,
        fromRoomId: reservation.roomId,
        toRoomId: room.id,
        reason: 'Guest checked in at front office.',
        actorUserId: context.actor.id,
        correlationId: context.correlationId,
      },
      select: { id: true },
    });

    return updated;
  }

  private async appendCheckInAudit(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
    stay: StayRow,
    room: RoomLockRow,
    operationalDay: OperationalDayView,
  ): Promise<void> {
    await this.audit.append(
      {
        organizationId: context.organizationId,
        propertyId,
        actorUserId: context.actor.id,
        action: 'reservation.checked_in',
        entityType: 'Reservation',
        entityId: reservation.id,
        correlationId: context.correlationId,
        metadata: {
          code: reservation.code,
          stayId: stay.id,
          roomId: room.id,
          localDate: operationalDay.localDate,
          operationalDate: operationalDay.operationalDate,
        },
      },
      transaction,
    );
  }
}
