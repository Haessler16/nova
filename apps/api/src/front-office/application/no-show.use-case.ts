import { ConflictException, Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { requirePropertyContext } from '../../inventory/room-state.service';
import { computeOperationalDay } from '../../operational-day/operational-day';
import { PrismaService } from '../../prisma/prisma.service';
import { formatCalendarDate } from '../../reservations/reservation-dates';
import { NoShowDto } from '../dto/front-office.dto';
import { PropertyLoader } from '../infrastructure/property-loader';
import { lockReservationRow } from '../infrastructure/row-locks';
import {
  mapReservationSummary,
  RESERVATION_SUMMARY_SELECT,
  type ReservationSummaryResponse,
  type ReservationSummaryRow,
  type Transaction,
} from './front-office.contracts';

/**
 * Marks a confirmed reservation as a no-show once its arrival date has passed.
 * The late-cancellation fee (if any) is a separate concern; this use case only
 * records the operational outcome and its audit trail.
 */
@Injectable()
export class NoShowUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly properties: PropertyLoader,
  ) {}

  async execute(
    context: TenantContext,
    reservationId: string,
    dto: NoShowDto,
  ): Promise<ReservationSummaryResponse> {
    const propertyId = requirePropertyContext(context);
    const property = await this.properties.load(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );
    const reason = dto.reason?.trim() ?? 'Guest did not arrive.';

    return this.prisma.$transaction(async (transaction) => {
      const reservation = await lockReservationRow(transaction, {
        organizationId: context.organizationId,
        propertyId,
        id: reservationId,
      });

      if (reservation.status === ReservationStatus.NO_SHOW) {
        return mapReservationSummary(reservation);
      }

      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'reservation_not_no_show_eligible',
          message: 'Only confirmed reservations can be marked as no-show.',
          details: { status: reservation.status },
        });
      }

      const checkInDate = formatCalendarDate(reservation.checkInDate);
      if (operationalDay.localDate <= checkInDate) {
        throw new ConflictException({
          code: 'no_show_too_early',
          message: 'A no-show can only be recorded after the arrival date.',
          details: { checkInDate, localDate: operationalDay.localDate },
        });
      }

      const stay = await transaction.stay.findUnique({
        where: { reservationId: reservation.id },
        select: { id: true },
      });
      if (stay !== null) {
        throw new ConflictException({
          code: 'reservation_has_stay',
          message: 'The reservation already has a stay record.',
          details: { stayId: stay.id },
        });
      }

      const updated = await transaction.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.NO_SHOW,
          noShowAt: this.clock.now(),
        },
        select: RESERVATION_SUMMARY_SELECT,
      });

      await this.recordNoShow(transaction, context, propertyId, reservation, reason, checkInDate);

      return mapReservationSummary(updated);
    });
  }

  /**
   * Reservation history keeps the status transition, while the audit log keeps
   * the operator-facing reason and the identifiers needed to trace the change.
   */
  private async recordNoShow(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservation: ReservationSummaryRow,
    reason: string,
    checkInDate: string,
  ): Promise<void> {
    await transaction.reservationHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        reservationId: reservation.id,
        action: 'reservation.no_show',
        fromStatus: ReservationStatus.CONFIRMED,
        toStatus: ReservationStatus.NO_SHOW,
        fromRoomId: reservation.roomId,
        toRoomId: reservation.roomId,
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
        action: 'reservation.no_show',
        entityType: 'Reservation',
        entityId: reservation.id,
        correlationId: context.correlationId,
        reason,
        metadata: {
          code: reservation.code,
          checkInDate,
          roomId: reservation.roomId,
        },
      },
      transaction,
    );
  }
}
