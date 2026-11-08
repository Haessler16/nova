export interface OperationalDay {
  /** Hotel operational date (calendar date, no time). */
  operationalDate: string;
  /** Calendar date in the property's IANA timezone. */
  localDate: string;
  /** Local time in HH:mm. */
  localTime: string;
  timezone: string;
  operationalDayStart: string;
}

const HH_MM = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Resolves the hotel operational day without assuming that it starts at
 * midnight. The operational date is the local calendar date minus one day when
 * the local time is before `operationalDayStart`.
 *
 * Implemented with Intl so DST transitions in the property timezone are handled
 * by the platform's IANA database rather than by a fixed UTC offset.
 */
export function computeOperationalDay(
  instant: Date,
  timezone: string,
  operationalDayStart: string,
): OperationalDay {
  if (Number.isNaN(instant.getTime())) {
    throw new Error('instant must be a valid Date');
  }

  const startMatch = HH_MM.exec(operationalDayStart);
  if (startMatch === null) {
    throw new Error('operationalDayStart must use HH:mm');
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new Error('timezone must be a valid IANA time zone');
  }

  const parts = formatter.formatToParts(instant);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  // Some ICU versions still return "24" for midnight with h23.
  const hour = Number(values.hour) === 24 ? 0 : Number(values.hour);
  const minute = Number(values.minute);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    throw new Error('Unable to resolve local property time.');
  }

  const localDate = `${pad(year)}-${pad(month)}-${pad(day)}`;
  const localTime = `${pad(hour)}:${pad(minute)}`;
  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  const localMinutes = hour * 60 + minute;

  const operationalDate = localMinutes < startMinutes ? addDays(localDate, -1) : localDate;

  return {
    operationalDate,
    localDate,
    localTime,
    timezone,
    operationalDayStart,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shift = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  shift.setUTCDate(shift.getUTCDate() + days);
  return `${shift.getUTCFullYear()}-${pad(shift.getUTCMonth() + 1)}-${pad(shift.getUTCDate())}`;
}
