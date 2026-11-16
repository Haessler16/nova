/**
 * Calendar-date helpers for E2E suites.
 *
 * Tests must derive "today" from the property timezone, never from the host's
 * UTC date. Around UTC midnight a western property (for example São Paulo,
 * UTC-3) is still on the previous calendar day, and a UTC-based helper creates
 * arrivals for "tomorrow" that the API correctly rejects as too early.
 */
export const E2E_PROPERTY_TIMEZONE = 'America/Sao_Paulo';

export function propertyCalendarDate(offsetDays = 0, timezone = E2E_PROPERTY_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(value('year'), value('month') - 1, value('day') + offsetDays))
    .toISOString()
    .slice(0, 10);
}

export function calendarInstant(calendarDate: string): string {
  return `${calendarDate}T00:00:00.000Z`;
}
