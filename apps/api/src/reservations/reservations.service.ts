import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { requirePropertyContext, RoomStateService } from '../inventory/room-state.service';
import { RoomAssignmentLeasesService } from '../inventory/room-assignment-leases.service';
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
import { ReservationLifecycleService } from './reservation-lifecycle.service';
import {
  assertStayWindow,
  formatCalendarDate,
  nightsBetween,
  parseCalendarDate,
} from './reservation-dates';
import {
  ACTIVE_RESERVATION_STATUSES,
  RESERVATION_SELECT,
  type ReservationAvailabilityItem,
  type ReservationHistoryEntry,
  type ReservationResponse,
  mapReservation,
} from './reservations.contracts';
import { reservationDateFilter } from './reservations.filters';
import { ReservationGuards } from './reservations.guards';

export type {
  ReservationAvailabilityItem,
  ReservationHistoryEntry,
  ReservationResponse,
} from './reservations.contracts';

/**
 * Read queries and room assignment for reservations. Create/update/cancel live
 * in ReservationLifecycleService and shared validations in ReservationGuards.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly clock: Clock,
    private readonly guards: ReservationGuards,
    private readonly lifecycle: ReservationLifecycleService,
  ) {}

  async list(
    context: TenantContext,
    query: ListReservationsQueryDto,
  ): Promise<{ items: ReservationResponse[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    const take = Math.min(query.limit ?? 50, 100);
    const where = await this.buildListWhere(context, propertyId, query);

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

  create(context: TenantContext, dto: CreateReservationDto): Promise<ReservationResponse> {
    return this.lifecycle.create(context, dto);
  }

  update(
    context: TenantContext,
    reservationId: string,
    dto: UpdateReservationDto,
  ): Promise<ReservationResponse> {
    return this.lifecycle.update(context, reservationId, dto);
  }

  cancel(
    context: TenantContext,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<ReservationResponse> {
    return this.lifecycle.cancel(context, reservationId, dto);
  }

  async assignRoom(
    context: TenantContext,
    reservationId: string,
    dto: AssignReservationRoomDto,
  ): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);
    const lease = (await this.leases.getMany(context, [dto.roomId])).get(dto.roomId);
    if (lease !== undefined && lease.ownerUserId !== context.actor.id) {
      throw new ConflictException({
        code: 'room_lease_held',
        message: `The room is being selected by ${lease.ownerDisplayName}.`,
        details: {
          ownerDisplayName: lease.ownerDisplayName,
          expiresAt: lease.expiresAt,
        },
      });
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await this.guards.lockReservation(
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

        await this.guards.assertRoomAssignable(transaction, {
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
      return this.guards.handleWriteError(error, {
        organizationId: context.organizationId,
        propertyId,
      });
    }
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
    // Availability is read-only and also used to assign rooms to reservations
    // that already started in another calendar timezone, so past windows are
    // accepted here; create/update still reject them.
    assertStayWindow(checkInDate, checkOutDate, this.clock.now(), { allowPast: true });

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

    const window = {
      checkInDate: formatCalendarDate(checkInDate),
      checkOutDate: formatCalendarDate(checkOutDate),
      nights: nightsBetween(checkInDate, checkOutDate),
    };

    if (rooms.length === 0) {
      return { ...window, items: [] };
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
      ...window,
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

  private async buildListWhere(
    context: TenantContext,
    propertyId: string,
    query: ListReservationsQueryDto,
  ): Promise<Prisma.ReservationWhereInput> {
    const where: Prisma.ReservationWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.guestId !== undefined ? { guestId: query.guestId } : {}),
      ...(query.roomTypeId !== undefined ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.roomId !== undefined ? { roomId: query.roomId } : {}),
    };

    const dateClauses = reservationDateFilter(query);
    if (dateClauses.length > 0) {
      where.AND = dateClauses;
    }

    const search = query.search?.trim() ?? '';
    if (search.length > 0) {
      where.OR = await this.buildSearchOr(context.organizationId, propertyId, search);
    }

    return where;
  }

  private async buildSearchOr(
    organizationId: string,
    propertyId: string,
    search: string,
  ): Promise<Prisma.ReservationWhereInput[]> {
    const or: Prisma.ReservationWhereInput[] = [
      { code: { contains: search, mode: 'insensitive' } },
      { guest: { fullName: { contains: search, mode: 'insensitive' } } },
      { room: { is: { number: { contains: search, mode: 'insensitive' } } } },
    ];

    // PostgreSQL `contains` does not fold accents. Front desk searches usually
    // type "jose" for "José", so resolve matching ids with `unaccent` and add
    // them to the same OR. The list stays tenant-scoped by the outer where.
    if (/[a-zA-Z\u00c0-\u024f]/.test(search)) {
      const accentIds = await this.guards.accentInsensitiveReservationIds(
        organizationId,
        propertyId,
        search,
      );
      if (accentIds.length > 0) {
        or.push({ id: { in: accentIds } });
      }
    }

    return or;
  }
}
