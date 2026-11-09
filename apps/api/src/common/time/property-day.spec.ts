import { BadRequestException } from '@nestjs/common';
import { addCalendarDays, propertyDayBounds, propertyDayStart } from './property-day';

describe('property day helpers', () => {
  it('resolves local midnight in a western timezone', () => {
    expect(propertyDayStart('2026-11-09', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-11-09T03:00:00.000Z',
    );
  });

  it('resolves local midnight in an eastern timezone', () => {
    expect(propertyDayStart('2026-11-09', 'Asia/Tokyo').toISOString()).toBe(
      '2026-11-08T15:00:00.000Z',
    );
  });

  it('follows DST changes in the property timezone', () => {
    expect(propertyDayStart('2026-03-08', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(propertyDayStart('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });

  it('treats the upper bound as an inclusive local day', () => {
    const bounds = propertyDayBounds('2026-01-14', '2026-01-15', 'America/Sao_Paulo');

    expect(bounds.gte?.toISOString()).toBe('2026-01-14T03:00:00.000Z');
    expect(bounds.lt?.toISOString()).toBe('2026-01-16T03:00:00.000Z');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => propertyDayStart('2026-02-31', 'America/Sao_Paulo')).toThrow(BadRequestException);
  });

  it('rejects an invalid property timezone', () => {
    expect(() => propertyDayStart('2026-11-09', 'Not/AZone')).toThrow(BadRequestException);
  });

  it('rejects an inverted range', () => {
    expect(() => propertyDayBounds('2026-01-16', '2026-01-15', 'America/Sao_Paulo')).toThrow(
      BadRequestException,
    );
  });

  it('adds calendar days across month boundaries', () => {
    expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01');
  });
});
