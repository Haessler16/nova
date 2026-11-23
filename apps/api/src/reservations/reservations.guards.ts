import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { RoomStateService } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertStayWindow, formatCalendarDate } from './reservation-dates';
import {
  ACTIVE_RESERVATION_STATUSES,
  RESERVATION_SELECT,
  type ReservationResponse,
  type ReservationRow,
  type Transaction,
  mapReservation,
} from './reservations.contracts';

/**
 * Shared reservation validations. They take the transaction (or connection)
 * they must run in, so callers keep owning the transaction boundary and the
 * error codes stay in one place.
 */
@Injectable()
export class ReservationGuards {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomState: RoomStateService,
    private readonly clock: Clock,
  ) {}

  async lockReservation(
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

  async assertRoomAssignable(
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

  async assertStayWindowForProperty(
    context: TenantContext,
    propertyId: string,
    checkInDate: Date,
    checkOutDate: Date,
  ): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: context.organizationId },
      select: { timezone: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the selected organization.',
      });
    }
    assertStayWindow(checkInDate, checkOutDate, this.clock.now(), {
      timezone: property.timezone,
    });
  }

  async assertGuest(
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

  async assertRoomType(
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

  async findByIdempotencyKey(
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
  async handleWriteError(
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

  async accentInsensitiveReservationIds(
    organizationId: string,
    propertyId: string,
    search: string,
  ): Promise<string[]> {
    // `!` is the LIKE escape character so user input cannot turn into a
    // wildcard. Only guest names need folding: reservation codes and room
    // numbers are ASCII and stay in the Prisma `contains` OR. The query returns
    // ids only; the caller re-applies every other filter and the tenant scope.
    const escaped = search.toLowerCase().replace(/[!%_]/g, (value) => `!${value}`);
    const pattern = `%${escaped}%`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT r."id"
      FROM "Reservation" r
      JOIN "Guest" g ON g."id" = r."guestId"
      WHERE r."organizationId" = ${organizationId}::uuid
        AND r."propertyId" = ${propertyId}::uuid
        AND public.unaccent(lower(g."fullName")) LIKE public.unaccent(${pattern}::text) ESCAPE '!'
      ORDER BY r."checkInDate" ASC, r."id" ASC
      LIMIT 200
    `;
    return rows.map((row) => row.id);
  }
}

export function assertOccupancyFits(
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

export function assertIdempotentReplay(
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
