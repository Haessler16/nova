import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { requirePropertyContext, RoomStateService } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignReservationRoomDto,
  CancelReservationDto,
  CreateReservationDto,
  ListReservationHistoryQueryDto,
  ListReservationsQueryDto,
  ReservationAvailabilityQueryDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import {
  assertStayWindow,
  formatCalendarDate,
  generateReservationCode,
  nightsBetween,
  parseCalendarDate,
} from './reservation-dates';

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

const RESERVATION_SELECT = {
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

type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;
type Transaction = Prisma.TransactionClient;

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
  ) {}

  async list(
    context: TenantContext,
    query: ListReservationsQueryDto,
  ): Promise<{ items: ReservationResponse[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    const take = Math.min(query.limit ?? 50, 100);

    const where: Prisma.ReservationWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.guestId !== undefined ? { guestId: query.guestId } : {}),
      ...(query.roomTypeId !== undefined ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.roomId !== undefined ? { roomId: query.roomId } : {}),
    };

    if (query.fromDate !== undefined || query.toDate !== undefined) {
      const from =
        query.fromDate !== undefined ? parseCalendarDate(query.fromDate, 'fromDate') : undefined;
      const to = query.toDate !== undefined ? parseCalendarDate(query.toDate, 'toDate') : undefined;
      if (from !== undefined && to !== undefined && to.getTime() <= from.getTime()) {
        throw new BadRequestException({
          code: 'invalid_date_filter',
          message: 'toDate must be after fromDate.',
        });
      }
      where.AND = [
        ...(from !== undefined ? [{ checkOutDate: { gt: from } }] : []),
        ...(to !== undefined ? [{ checkInDate: { lt: to } }] : []),
      ];
    }

    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { guest: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.reservation.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
      select: RESERVATION_SELECT,
    });

    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, take) : rows).map(mapReservation);

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async get(context: TenantContext, reservationId: string): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: RESERVATION_SELECT,
    });

    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }

    return mapReservation(reservation);
  }

  async create(context: TenantContext, dto: CreateReservationDto): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);
    const checkInDate = parseCalendarDate(dto.checkInDate, 'checkInDate');
    const checkOutDate = parseCalendarDate(dto.checkOutDate, 'checkOutDate');
    assertStayWindow(checkInDate, checkOutDate);
    const children = dto.children ?? 0;

    if (dto.idempotencyKey !== undefined) {
      const existing = await this.findByIdempotencyKey(
        context.organizationId,
        propertyId,
        dto.idempotencyKey,
      );
      if (existing !== null) {
        assertIdempotentReplay(existing, {
          guestId: dto.guestId,
          roomTypeId: dto.roomTypeId,
          checkInDate,
          checkOutDate,
        });
        return mapReservation(existing);
      }
    }

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        await this.assertGuest(transaction, context.organizationId, propertyId, dto.guestId);
        const roomType = await this.assertRoomType(
          transaction,
          context.organizationId,
          propertyId,
          dto.roomTypeId,
        );
        assertOccupancyFits(roomType, dto.adults, children);

        let roomId: string | null = null;
        if (dto.roomId !== undefined) {
          await this.assertRoomAssignable(transaction, {
            organizationId: context.organizationId,
            propertyId,
            roomId: dto.roomId,
            roomTypeId: dto.roomTypeId,
            checkInDate,
            checkOutDate,
          });
          roomId = dto.roomId;
        }

        const reservation = await transaction.reservation.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            code: dto.code ?? generateReservationCode(checkInDate),
            status: ReservationStatus.CONFIRMED,
            source: dto.source?.trim(),
            checkInDate,
            checkOutDate,
            adults: dto.adults,
            children,
            guestId: dto.guestId,
            roomTypeId: dto.roomTypeId,
            roomId,
            notes: dto.notes?.trim(),
            idempotencyKey: dto.idempotencyKey,
            createdByUserId: context.actor.id,
          },
          select: RESERVATION_SELECT,
        });

        await transaction.reservationHistory.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId: reservation.id,
            action: 'reservation.created',
            toStatus: ReservationStatus.CONFIRMED,
            toRoomId: roomId,
            reason:
              roomId === null
                ? 'Reservation created without room assignment.'
                : 'Reservation created with room assignment.',
            actorUserId: context.actor.id,
            correlationId: context.correlationId,
          },
          select: { id: true },
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'reservation.created',
            entityType: 'Reservation',
            entityId: reservation.id,
            correlationId: context.correlationId,
            metadata: {
              code: reservation.code,
              status: reservation.status,
              checkInDate: dto.checkInDate,
              checkOutDate: dto.checkOutDate,
              adults: reservation.adults,
              children: reservation.children,
              roomId,
            },
          },
          transaction,
        );

        return reservation;
      });

      return mapReservation(created);
    } catch (error) {
      return this.handleWriteError(error, {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      });
    }
  }

  async update(
    context: TenantContext,
    reservationId: string,
    dto: UpdateReservationDto,
  ): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const current = await this.lockReservation(
        transaction,
        context.organizationId,
        propertyId,
        reservationId,
      );

      if (current.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'reservation_not_editable',
          message: 'Only confirmed reservations can be modified.',
          details: { status: current.status },
        });
      }

      const checkInDate =
        dto.checkInDate !== undefined
          ? parseCalendarDate(dto.checkInDate, 'checkInDate')
          : current.checkInDate;
      const checkOutDate =
        dto.checkOutDate !== undefined
          ? parseCalendarDate(dto.checkOutDate, 'checkOutDate')
          : current.checkOutDate;
      assertStayWindow(checkInDate, checkOutDate);

      const adults = dto.adults ?? current.adults;
      const children = dto.children ?? current.children;
      const guestId = dto.guestId ?? current.guestId;
      const roomTypeId = dto.roomTypeId ?? current.roomTypeId;

      await this.assertGuest(transaction, context.organizationId, propertyId, guestId);
      const roomType = await this.assertRoomType(
        transaction,
        context.organizationId,
        propertyId,
        roomTypeId,
      );
      assertOccupancyFits(roomType, adults, children);

      if (current.roomId !== null && roomTypeId !== current.roomTypeId) {
        throw new ConflictException({
          code: 'room_type_change_requires_unassigned_room',
          message: 'Unassign the room before changing the reservation room type.',
        });
      }

      if (current.roomId !== null) {
        await this.assertRoomAssignable(transaction, {
          organizationId: context.organizationId,
          propertyId,
          roomId: current.roomId,
          roomTypeId,
          checkInDate,
          checkOutDate,
          excludeReservationId: current.id,
        });
      }

      const updated = await transaction.reservation.update({
        where: { id: current.id },
        data: {
          checkInDate,
          checkOutDate,
          adults,
          children,
          guestId,
          roomTypeId,
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
        },
        select: RESERVATION_SELECT,
      });

      await transaction.reservationHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: current.id,
          action: 'reservation.updated',
          fromStatus: current.status,
          toStatus: updated.status,
          fromRoomId: current.roomId,
          toRoomId: updated.roomId,
          reason: 'Reservation details updated.',
          actorUserId: context.actor.id,
          correlationId: context.correlationId,
        },
        select: { id: true },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'reservation.updated',
          entityType: 'Reservation',
          entityId: current.id,
          correlationId: context.correlationId,
          metadata: {
            before: {
              checkInDate: formatCalendarDate(current.checkInDate),
              checkOutDate: formatCalendarDate(current.checkOutDate),
              adults: current.adults,
              children: current.children,
              roomTypeId: current.roomTypeId,
            },
            after: {
              checkInDate: formatCalendarDate(updated.checkInDate),
              checkOutDate: formatCalendarDate(updated.checkOutDate),
              adults: updated.adults,
              children: updated.children,
              roomTypeId: updated.roomTypeId,
            },
          },
        },
        transaction,
      );

      return mapReservation(updated);
    });
  }

  async assignRoom(
    context: TenantContext,
    reservationId: string,
    dto: AssignReservationRoomDto,
  ): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await this.lockReservation(
          transaction,
          context.organizationId,
          propertyId,
          reservationId,
        );

        if (current.status !== ReservationStatus.CONFIRMED) {
          throw new ConflictException({
            code: 'reservation_not_assignable',
            message: 'Only confirmed reservations can be assigned a room.',
            details: { status: current.status },
          });
        }

        if (current.roomId === dto.roomId) {
          return mapReservation(current);
        }

        await this.assertRoomAssignable(transaction, {
          organizationId: context.organizationId,
          propertyId,
          roomId: dto.roomId,
          roomTypeId: current.roomTypeId,
          checkInDate: current.checkInDate,
          checkOutDate: current.checkOutDate,
          excludeReservationId: current.id,
        });

        const updated = await transaction.reservation.update({
          where: { id: current.id },
          data: { roomId: dto.roomId },
          select: RESERVATION_SELECT,
        });

        await transaction.reservationHistory.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId: current.id,
            action: 'reservation.room_assigned',
            fromStatus: current.status,
            toStatus: updated.status,
            fromRoomId: current.roomId,
            toRoomId: updated.roomId,
            reason: current.roomId === null ? 'Room assigned.' : 'Room reassigned.',
            actorUserId: context.actor.id,
            correlationId: context.correlationId,
          },
          select: { id: true },
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'reservation.room_assigned',
            entityType: 'Reservation',
            entityId: current.id,
            correlationId: context.correlationId,
            metadata: {
              code: current.code,
              fromRoomId: current.roomId,
              toRoomId: updated.roomId,
            },
          },
          transaction,
        );

        return mapReservation(updated);
      });
    } catch (error) {
      return this.handleWriteError(error, {
        organizationId: context.organizationId,
        propertyId,
      });
    }
  }

  async cancel(
    context: TenantContext,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const current = await this.lockReservation(
        transaction,
        context.organizationId,
        propertyId,
        reservationId,
      );

      if (current.status === ReservationStatus.CANCELLED) {
        return mapReservation(current);
      }

      if (current.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'reservation_not_cancellable',
          message: 'Only confirmed reservations can be cancelled.',
          details: { status: current.status },
        });
      }

      const reason = dto.reason?.trim() ?? 'Reservation cancelled.';
      const cancelled = await transaction.reservation.update({
        where: { id: current.id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        select: RESERVATION_SELECT,
      });

      await transaction.reservationHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: current.id,
          action: 'reservation.cancelled',
          fromStatus: current.status,
          toStatus: ReservationStatus.CANCELLED,
          fromRoomId: current.roomId,
          toRoomId: cancelled.roomId,
          reason,
          actorUserId: context.actor.id,
          correlationId: context.correlationId,
        },
        select: { id: true },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'reservation.cancelled',
          entityType: 'Reservation',
          entityId: current.id,
          correlationId: context.correlationId,
          reason,
          metadata: {
            code: current.code,
            roomId: current.roomId,
            checkInDate: formatCalendarDate(current.checkInDate),
            checkOutDate: formatCalendarDate(current.checkOutDate),
          },
        },
        transaction,
      );

      return mapReservation(cancelled);
    });
  }

  async getHistory(
    context: TenantContext,
    reservationId: string,
    query: ListReservationHistoryQueryDto,
  ): Promise<{ items: ReservationHistoryEntry[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: { id: true },
    });

    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }

    const take = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.reservationHistory.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        reservationId,
      },
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        fromRoomId: true,
        toRoomId: true,
        reason: true,
        actorUserId: true,
        correlationId: true,
        occurredAt: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async availability(
    context: TenantContext,
    query: ReservationAvailabilityQueryDto,
  ): Promise<{
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    items: ReservationAvailabilityItem[];
  }> {
    const propertyId = requirePropertyContext(context);
    const checkInDate = parseCalendarDate(query.checkInDate, 'checkInDate');
    const checkOutDate = parseCalendarDate(query.checkOutDate, 'checkOutDate');
    assertStayWindow(checkInDate, checkOutDate);

    // Expired blocks should not keep rooms out of availability.
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const rooms = await this.prisma.room.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        status: 'ACTIVE',
        operationalState: 'AVAILABLE',
        ...(query.roomTypeId !== undefined ? { roomTypeId: query.roomTypeId } : {}),
      },
      select: {
        id: true,
        number: true,
        floor: true,
        building: true,
        roomTypeId: true,
        roomType: { select: { name: true, code: true } },
      },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
    });

    if (rooms.length === 0) {
      return {
        checkInDate: formatCalendarDate(checkInDate),
        checkOutDate: formatCalendarDate(checkOutDate),
        nights: nightsBetween(checkInDate, checkOutDate),
        items: [],
      };
    }

    const roomIds = rooms.map((room) => room.id);

    const [blockedBlocks, overlappingReservations] = await Promise.all([
      this.prisma.roomBlock.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: 'ACTIVE',
          startsAt: { lt: checkOutDate },
          endsAt: { gt: checkInDate },
        },
        select: { roomId: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: { in: ACTIVE_RESERVATION_STATUSES },
          checkInDate: { lt: checkOutDate },
          checkOutDate: { gt: checkInDate },
        },
        select: { roomId: true },
      }),
    ]);

    const unavailable = new Set<string>([
      ...blockedBlocks.map((block) => block.roomId as string),
      ...overlappingReservations.map((reservation) => reservation.roomId as string),
    ]);

    return {
      checkInDate: formatCalendarDate(checkInDate),
      checkOutDate: formatCalendarDate(checkOutDate),
      nights: nightsBetween(checkInDate, checkOutDate),
      items: rooms
        .filter((room) => !unavailable.has(room.id))
        .map((room) => ({
          roomId: room.id,
          number: room.number,
          floor: room.floor,
          building: room.building,
          roomTypeId: room.roomTypeId,
          roomType: room.roomType,
        })),
    };
  }

  private async lockReservation(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    reservationId: string,
  ): Promise<ReservationRow> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Reservation"
      WHERE "id" = ${reservationId}::uuid
        AND "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }

    return transaction.reservation.findFirstOrThrow({
      where: { id: reservationId },
      select: RESERVATION_SELECT,
    });
  }

  private async assertRoomAssignable(
    transaction: Transaction,
    input: {
      organizationId: string;
      propertyId: string;
      roomId: string;
      roomTypeId: string;
      checkInDate: Date;
      checkOutDate: Date;
      excludeReservationId?: string;
    },
  ): Promise<void> {
    // Serializes concurrent assignments/blocks on the same room. PostgreSQL
    // constraints remain the final authority for reservation overlaps.
    await this.roomState.lockRoom(
      transaction,
      input.organizationId,
      input.propertyId,
      input.roomId,
    );

    const room = await transaction.room.findFirst({
      where: {
        id: input.roomId,
        organizationId: input.organizationId,
        propertyId: input.propertyId,
      },
      select: { id: true, roomTypeId: true, status: true, number: true },
    });

    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    if (room.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'room_inactive',
        message: 'The selected room is not active.',
      });
    }

    if (room.roomTypeId !== input.roomTypeId) {
      throw new ConflictException({
        code: 'room_type_mismatch',
        message: 'The selected room does not belong to the reservation room type.',
      });
    }

    await this.roomState.assertNoOverlappingActiveBlock(transaction, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      startsAt: input.checkInDate,
      endsAt: input.checkOutDate,
    });

    const overlap = await transaction.reservation.findFirst({
      where: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        roomId: input.roomId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
        ...(input.excludeReservationId !== undefined
          ? { id: { not: input.excludeReservationId } }
          : {}),
      },
      select: { id: true, code: true, checkInDate: true, checkOutDate: true },
    });

    if (overlap !== null) {
      throw new ConflictException({
        code: 'room_not_available',
        message: 'The room already has an active reservation overlapping these dates.',
        details: {
          reservationId: overlap.id,
          code: overlap.code,
          checkInDate: formatCalendarDate(overlap.checkInDate),
          checkOutDate: formatCalendarDate(overlap.checkOutDate),
        },
      });
    }
  }

  private async assertGuest(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    guestId: string,
  ): Promise<void> {
    const guest = await transaction.guest.findFirst({
      where: {
        id: guestId,
        organizationId,
        propertyId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (guest === null) {
      throw new NotFoundException({
        code: 'guest_not_found',
        message: 'Active guest not found in the selected property.',
      });
    }
  }

  private async assertRoomType(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    roomTypeId: string,
  ): Promise<{ capacityAdults: number; capacityChildren: number }> {
    const roomType = await transaction.roomType.findFirst({
      where: {
        id: roomTypeId,
        organizationId,
        propertyId,
        status: 'ACTIVE',
      },
      select: { capacityAdults: true, capacityChildren: true },
    });

    if (roomType === null) {
      throw new NotFoundException({
        code: 'room_type_not_found',
        message: 'Room type not found in the selected property.',
      });
    }

    return roomType;
  }

  private async findByIdempotencyKey(
    organizationId: string,
    propertyId: string,
    idempotencyKey: string,
  ): Promise<ReservationRow | null> {
    return this.prisma.reservation.findFirst({
      where: { organizationId, propertyId, idempotencyKey },
      select: RESERVATION_SELECT,
    });
  }

  /**
   * Maps the raw PostgreSQL exclusion violation (double booking) and unique
   * conflicts into stable API errors. Idempotent replays return the original
   * reservation when the payload matches.
   */
  private async handleWriteError(
    error: unknown,
    scope: { organizationId: string; propertyId: string; idempotencyKey?: string },
  ): Promise<ReservationResponse> {
    if (error instanceof ConflictException) {
      throw error;
    }

    if (isExclusionViolation(error)) {
      throw new ConflictException({
        code: 'room_not_available',
        message: 'The room is already reserved for these dates.',
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[])
        : typeof error.meta?.target === 'string'
          ? [error.meta.target]
          : [];

      if (
        scope.idempotencyKey !== undefined &&
        (target.includes('idempotencyKey') || error.message.includes('idempotencyKey'))
      ) {
        const existing = await this.findByIdempotencyKey(
          scope.organizationId,
          scope.propertyId,
          scope.idempotencyKey,
        );
        if (existing !== null) {
          return mapReservation(existing);
        }
      }

      throw new ConflictException({
        code: 'reservation_conflict',
        message: 'A reservation with the same code already exists in the property.',
      });
    }

    throw error;
  }
}

function assertOccupancyFits(
  roomType: { capacityAdults: number; capacityChildren: number },
  adults: number,
  children: number,
): void {
  if (adults > roomType.capacityAdults || children > roomType.capacityChildren) {
    throw new ConflictException({
      code: 'occupancy_exceeds_room_type',
      message: 'The occupancy exceeds the room type capacity.',
      details: {
        capacityAdults: roomType.capacityAdults,
        capacityChildren: roomType.capacityChildren,
      },
    });
  }
}

function assertIdempotentReplay(
  existing: ReservationRow,
  expected: { guestId: string; roomTypeId: string; checkInDate: Date; checkOutDate: Date },
): void {
  const sameStay =
    existing.guestId === expected.guestId &&
    existing.roomTypeId === expected.roomTypeId &&
    existing.checkInDate.getTime() === expected.checkInDate.getTime() &&
    existing.checkOutDate.getTime() === expected.checkOutDate.getTime();

  if (!sameStay) {
    throw new ConflictException({
      code: 'idempotency_key_reuse',
      message: 'This idempotency key was already used with a different reservation payload.',
    });
  }
}

function isExclusionViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    message.includes('Reservation_room_date_no_overlap') ||
    message.includes('23P01') ||
    message.toLowerCase().includes('exclusion constraint')
  );
}

function mapReservation(row: ReservationRow): ReservationResponse {
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
