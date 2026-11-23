import { ConflictException, Injectable } from '@nestjs/common';
import { GuestAgeGroup, ReservationGuestOrigin, ReservationGuestRole, ReservationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CancelReservationDto,
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import {
  formatCalendarDate,
  generateReservationCode,
  parseCalendarDate,
} from './reservation-dates';
import {
  RESERVATION_SELECT,
  type ReservationResponse,
  type ReservationRow,
  type Transaction,
  mapReservation,
} from './reservations.contracts';
import {
  assertIdempotentReplay,
  assertOccupancyFits,
  ReservationGuards,
} from './reservations.guards';

/**
 * Reservation lifecycle writes (create, update, cancel). Kept apart from the
 * read queries so both files stay small; every validation and error code lives
 * in ReservationGuards and is shared with room assignment.
 */
@Injectable()
export class ReservationLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: ReservationGuards,
    private readonly clock: Clock,
  ) {}

  async create(context: TenantContext, dto: CreateReservationDto): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);
    const checkInDate = parseCalendarDate(dto.checkInDate, 'checkInDate');
    const checkOutDate = parseCalendarDate(dto.checkOutDate, 'checkOutDate');
    await this.guards.assertStayWindowForProperty(
      context,
      propertyId,
      checkInDate,
      checkOutDate,
    );
    const children = dto.children ?? 0;

    if (dto.idempotencyKey !== undefined) {
      const existing = await this.guards.findByIdempotencyKey(
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
        await this.guards.assertGuest(
          transaction,
          context.organizationId,
          propertyId,
          dto.guestId,
        );
        const roomType = await this.guards.assertRoomType(
          transaction,
          context.organizationId,
          propertyId,
          dto.roomTypeId,
        );
        assertOccupancyFits(roomType, dto.adults, children);

        let roomId: string | null = null;
        if (dto.roomId !== undefined) {
          await this.guards.assertRoomAssignable(transaction, {
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

        await this.writeCreationRecords(transaction, context, propertyId, dto, reservation);
        return reservation;
      });

      return mapReservation(created);
    } catch (error) {
      return this.guards.handleWriteError(error, {
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
      const current = await this.guards.lockReservation(
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
      await this.guards.assertStayWindowForProperty(
        context,
        propertyId,
        checkInDate,
        checkOutDate,
      );

      const adults = dto.adults ?? current.adults;
      const children = dto.children ?? current.children;
      const guestId = dto.guestId ?? current.guestId;
      const roomTypeId = dto.roomTypeId ?? current.roomTypeId;

      await this.guards.assertGuest(transaction, context.organizationId, propertyId, guestId);
      const roomType = await this.guards.assertRoomType(
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
        await this.guards.assertRoomAssignable(transaction, {
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

      if (guestId !== current.guestId) {
        await this.syncPrimaryGuest(transaction, context, propertyId, current.id, guestId);
      }

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
            before: staySnapshot(current),
            after: staySnapshot(updated),
          },
        },
        transaction,
      );

      return mapReservation(updated);
    });
  }

  async cancel(
    context: TenantContext,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<ReservationResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const current = await this.guards.lockReservation(
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
          cancelledAt: this.clock.now(),
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

  private async writeCreationRecords(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    dto: CreateReservationDto,
    reservation: ReservationRow,
  ): Promise<void> {
    await transaction.reservationGuest.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        role: ReservationGuestRole.PRIMARY,
        ageGroup: GuestAgeGroup.UNKNOWN,
        origin: ReservationGuestOrigin.MANUAL,
      },
      select: { id: true },
    });

    await transaction.reservationHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
        action: 'reservation.created',
        toStatus: ReservationStatus.CONFIRMED,
        toRoomId: reservation.roomId,
        reason:
          reservation.roomId === null
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
          roomId: reservation.roomId,
        },
      },
      transaction,
    );
  }

  private async syncPrimaryGuest(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservationId: string,
    guestId: string,
  ): Promise<void> {
    const duplicate = await transaction.reservationGuest.findFirst({
      where: {
        reservationId,
        guestId,
        role: { not: ReservationGuestRole.PRIMARY },
      },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        code: 'guest_already_in_party',
        message: 'That guest is already a companion in this reservation party.',
      });
    }

    const primary = await transaction.reservationGuest.findFirst({
      where: { reservationId, role: ReservationGuestRole.PRIMARY },
      select: { id: true },
    });
    if (primary === null) {
      await transaction.reservationGuest.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId,
          guestId,
          role: ReservationGuestRole.PRIMARY,
          ageGroup: GuestAgeGroup.UNKNOWN,
          origin: ReservationGuestOrigin.MANUAL,
        },
        select: { id: true },
      });
      return;
    }

    await transaction.reservationGuest.update({
      where: { id: primary.id },
      data: { guestId },
      select: { id: true },
    });
  }
}

function staySnapshot(
  reservation: Pick<
    ReservationRow,
    'checkInDate' | 'checkOutDate' | 'adults' | 'children' | 'roomTypeId'
  >,
): Record<string, string | number> {
  return {
    checkInDate: formatCalendarDate(reservation.checkInDate),
    checkOutDate: formatCalendarDate(reservation.checkOutDate),
    adults: reservation.adults,
    children: reservation.children,
    roomTypeId: reservation.roomTypeId,
  };
}
