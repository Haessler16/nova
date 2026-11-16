import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import timezonePlugin from 'dayjs/plugin/timezone';
import utcPlugin from 'dayjs/plugin/utc';

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);

/**
 * Converts hotel calendar dates (`YYYY-MM-DD`) into instants using the
 * property's IANA timezone. Instant-based filters (audit, folio creation date)
 * must use this instead of UTC midnights: a local day can start on the previous
 * UTC date in western zones and on the same UTC date in eastern zones.
 *
 * Day.js' timezone plugin resolves DST through the platform IANA database;
 * there are no fixed offsets here. Calendar-date comparisons (reservation
 * check-in/out) intentionally do not use this helper because they are
 * date-only, timezone-independent values.
 */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PropertyDayBounds {
  gte?: Date;
  lt?: Date;
}

export function propertyDayStart(calendarDate: string, timezone: string): Date {
  parseCalendarDate(calendarDate);
  assertTimezone(timezone);

  return dayjs.tz(`${calendarDate} 00:00:00`, 'YYYY-MM-DD HH:mm:ss', timezone).toDate();
}

/**
 * `fromDate` and `toDate` are inclusive property-local days. The returned
 * `lt` is the start of the day after `toDate`, so callers can use `[gte, lt)`.
 */
export function propertyDayBounds(
  fromDate: string | undefined,
  toDate: string | undefined,
  timezone: string,
): PropertyDayBounds {
  if (fromDate !== undefined && toDate !== undefined && toDate < fromDate) {
    throw new BadRequestException({
      code: 'invalid_date_filter',
      message: 'toDate must be on or after fromDate.',
    });
  }

  return {
    ...(fromDate !== undefined ? { gte: propertyDayStart(fromDate, timezone) } : {}),
    ...(toDate !== undefined ? { lt: propertyDayStart(addCalendarDays(toDate, 1), timezone) } : {}),
  };
}

export function addCalendarDays(calendarDate: string, days: number): string {
  parseCalendarDate(calendarDate);
  return dayjs.utc(calendarDate).add(days, 'day').format('YYYY-MM-DD');
}

/**
 * Calendar date (`YYYY-MM-DD`) at an instant in the property's timezone.
 *
 * Use this to derive "today" from `new Date()` or to group instants (audit,
 * folio creation, payments) by hotel day. Do not apply it to values that are
 * already calendar dates: `Reservation.checkInDate` or
 * `OperationalDay.operationalDate` are date-only and timezone-independent.
 */
export function calendarDateInTimezone(instant: Date, timezone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new Error('instant must be a valid Date');
  }
  assertTimezone(timezone);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function parseCalendarDate(calendarDate: string): void {
  const match = CALENDAR_DATE_PATTERN.exec(calendarDate);
  if (match === null) {
    throw invalidCalendarDate();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw invalidCalendarDate();
  }
}

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
  } catch {
    throw invalidPropertyTimezone();
  }
}

function invalidCalendarDate(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_calendar_date',
    message: 'La fecha debe ser una fecha calendario válida YYYY-MM-DD.',
  });
}

function invalidPropertyTimezone(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_property_timezone',
    message: 'La propiedad tiene una zona horaria IANA inválida.',
  });
}
