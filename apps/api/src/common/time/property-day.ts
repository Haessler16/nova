import { BadRequestException } from '@nestjs/common';

/**
 * Converts hotel calendar dates (`YYYY-MM-DD`) into instants using the
 * property's IANA timezone. Instant-based filters (audit, folio creation date)
 * must use this instead of UTC midnights: a local day can start on the previous
 * UTC date in western zones and on the same UTC date in eastern zones.
 *
 * DST is resolved by the platform IANA database through `Intl`, not by a fixed
 * offset. Calendar-date comparisons (reservation check-in/out) intentionally do
 * not use this helper because they are date-only, timezone-independent values.
 */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

export interface PropertyDayBounds {
  gte?: Date;
  lt?: Date;
}

export function propertyDayStart(calendarDate: string, timezone: string): Date {
  const { year, month, day } = parseParts(calendarDate);
  const wallAsUtc = Date.UTC(year, month - 1, day);

  let instant = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timezone);
  const corrected = wallAsUtc - zoneOffsetMs(new Date(instant), timezone);
  if (corrected !== instant) {
    instant = corrected;
  }

  return new Date(instant);
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
  const { year, month, day } = parseParts(calendarDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseParts(calendarDate: string): CalendarParts {
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

  return { year, month, day };
}

function zoneOffsetMs(instant: Date, timezone: string): number {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
  } catch {
    throw new BadRequestException({
      code: 'invalid_property_timezone',
      message: 'La propiedad tiene una zona horaria IANA inválida.',
    });
  }

  const label =
    formatter.formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';

  if (label === 'GMT' || label === 'UTC') {
    return 0;
  }

  const match = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(label);
  if (match === null) {
    throw new BadRequestException({
      code: 'invalid_property_timezone',
      message: 'La propiedad tiene una zona horaria IANA inválida.',
    });
  }

  const sign = match[1] === '-' ? -1 : 1;
  const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? '0');
  return sign * seconds * 1000;
}

function invalidCalendarDate(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_calendar_date',
    message: 'La fecha debe ser una fecha calendario válida YYYY-MM-DD.',
  });
}
