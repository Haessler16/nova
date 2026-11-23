import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListReservationsQueryDto } from './dto/reservation.dto';
import { parseCalendarDate } from './reservation-dates';

/**
 * Translates the optional stay-window filters into Prisma `AND` clauses. The
 * overlap semantics are unchanged: a reservation is listed when its stay
 * intersects the requested window.
 */
export function reservationDateFilter(
  query: ListReservationsQueryDto,
): Prisma.ReservationWhereInput[] {
  if (query.fromDate === undefined && query.toDate === undefined) {
    return [];
  }

  const from =
    query.fromDate !== undefined ? parseCalendarDate(query.fromDate, 'fromDate') : undefined;
  const to = query.toDate !== undefined ? parseCalendarDate(query.toDate, 'toDate') : undefined;
  if (from !== undefined && to !== undefined && to.getTime() <= from.getTime()) {
    throw new BadRequestException({
      code: 'invalid_date_filter',
      message: 'toDate must be after fromDate.',
    });
  }

  return [
    ...(from !== undefined ? [{ checkOutDate: { gt: from } }] : []),
    ...(to !== undefined ? [{ checkInDate: { lt: to } }] : []),
  ];
}
