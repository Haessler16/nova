import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { calendarDateInTimezone } from '../common/time/property-day';

export { calendarDateInTimezone };

/**
 * Reservation dates are hotel calendar dates (`YYYY-MM-DD`) in the property
 * timezone, not instants. They are stored as PostgreSQL `date` and interpreted
 * at UTC midnight by Prisma; the stay occupies [checkInDate, checkOutDate).
 *
 * Phase 3 deliberately keeps date-level granularity. Check-in/check-out times
 * and instant-precision availability belong to the Front Office phase.
 */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NIGHTS = 366;

export function parseCalendarDate(value: string, field: string): Date {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new BadRequestException({
      code: 'invalid_calendar_date',
      message: `${field} must use the YYYY-MM-DD format.`,
    });
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatCalendarDate(date) !== value) {
    throw new BadRequestException({
      code: 'invalid_calendar_date',
      message: `${field} is not a valid calendar date.`,
    });
  }

  return date;
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(checkInDate: Date, checkOutDate: Date): number {
  return Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * `now` is required so every caller injects `Clock` instead of reading the wall
 * clock here; that keeps the operational-day rules testable with a fixed time.
 */
export function assertStayWindow(
  checkInDate: Date,
  checkOutDate: Date,
  now: Date,
  options: { allowPast?: boolean; timezone?: string } = {},
): void {
  if (checkOutDate.getTime() <= checkInDate.getTime()) {
    throw new BadRequestException({
      code: 'invalid_stay_window',
      message: 'checkOutDate must be after checkInDate.',
    });
  }

  if (nightsBetween(checkInDate, checkOutDate) > MAX_NIGHTS) {
    throw new BadRequestException({
      code: 'reservation_too_long',
      message: `A reservation cannot exceed ${MAX_NIGHTS} nights.`,
    });
  }

  if (options.allowPast === true) {
    return;
  }

  const todayCalendarDate =
    options.timezone !== undefined
      ? calendarDateInTimezone(now, options.timezone)
      : formatCalendarDate(now);
  const today = new Date(`${todayCalendarDate}T00:00:00.000Z`);
  if (checkInDate.getTime() < today.getTime()) {
    throw new BadRequestException({
      code: 'reservation_in_past',
      message: 'A reservation cannot start in the past.',
    });
  }
}

/** `RES-YYYYMMDD-XXXXXX`; unique per property via a database constraint. */
export function generateReservationCode(checkInDate: Date): string {
  return `RES-${formatCalendarDate(checkInDate).replace(/-/g, '')}-${randomBytes(4)
    .toString('hex')
    .toUpperCase()
    .slice(0, 6)}`;
}
