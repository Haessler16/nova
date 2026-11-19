import { describe, expect, it } from 'vitest';
import {
  calendarDateInTimezone,
  formatCalendarDate,
  formatJson,
  formatMoney,
  initials,
} from './format';

describe('formatters', () => {
  it('formats decimal money without binary float loss of the integer part', () => {
    expect(formatMoney('1234.5', 'BRL')).toContain('1.234,50');
    expect(formatMoney(null)).toContain('0,00');
  });

  it('falls back to the raw value when the amount is not numeric', () => {
    expect(formatMoney('n/a', 'USD')).toBe('n/a USD');
  });

  it('formats calendar dates without timezone shifts', () => {
    expect(formatCalendarDate('2026-11-08')).toBe('08/11/2026');
    expect(formatCalendarDate('not-a-date')).toBe('not-a-date');
  });

  it('resolves the property calendar date from an instant', () => {
    const instant = new Date('2026-11-16T00:42:00.000Z');

    expect(calendarDateInTimezone(instant, 'America/Sao_Paulo')).toBe('2026-11-15');
    expect(calendarDateInTimezone(instant, 'Asia/Tokyo')).toBe('2026-11-16');
  });

  it('builds initials and json previews', () => {
    expect(initials('Ana Souza')).toBe('AS');
    expect(initials('Ana')).toBe('A');
    expect(formatJson(null)).toBe('—');
    expect(formatJson({ a: 1 })).toContain('"a": 1');
  });
});
