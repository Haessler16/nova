import { computeOperationalDay } from './operational-day';

describe('computeOperationalDay', () => {
  it('keeps the previous operational date before the configured start', () => {
    const result = computeOperationalDay(
      new Date('2026-11-08T02:30:00.000Z'),
      'America/Sao_Paulo',
      '06:00',
    );

    expect(result.localDate).toBe('2026-11-07');
    expect(result.localTime).toBe('23:30');
    expect(result.operationalDate).toBe('2026-11-07');
  });

  it('rolls to the new operational date at the configured local start', () => {
    expect(
      computeOperationalDay(new Date('2026-11-08T08:59:00.000Z'), 'America/Sao_Paulo', '06:00')
        .operationalDate,
    ).toBe('2026-11-07');

    expect(
      computeOperationalDay(new Date('2026-11-08T09:00:00.000Z'), 'America/Sao_Paulo', '06:00')
        .operationalDate,
    ).toBe('2026-11-08');
  });

  it('handles month and year boundaries', () => {
    const result = computeOperationalDay(
      new Date('2026-01-01T02:00:00.000Z'),
      'America/Sao_Paulo',
      '06:00',
    );

    expect(result.localDate).toBe('2025-12-31');
    expect(result.operationalDate).toBe('2025-12-31');
  });

  it('uses the property timezone rather than the server timezone', () => {
    const result = computeOperationalDay(
      new Date('2026-11-08T12:00:00.000Z'),
      'Asia/Tokyo',
      '06:00',
    );

    expect(result.localDate).toBe('2026-11-08');
    expect(result.localTime).toBe('21:00');
    expect(result.operationalDate).toBe('2026-11-08');
  });

  it('follows the property DST transition instead of a fixed UTC offset', () => {
    // America/New_York springs forward on 2026-03-08 (05:00Z becomes 06:00Z
    // at 02:00 local). 09:30Z is 05:30 local after the change (EDT) and
    // therefore already the new operational date with a 05:00 start.
    const beforeChange = computeOperationalDay(
      new Date('2026-03-08T04:30:00.000Z'),
      'America/New_York',
      '05:00',
    );
    const afterChange = computeOperationalDay(
      new Date('2026-03-08T09:30:00.000Z'),
      'America/New_York',
      '05:00',
    );

    expect(beforeChange.localTime).toBe('23:30');
    expect(beforeChange.operationalDate).toBe('2026-03-07');
    expect(afterChange.localTime).toBe('05:30');
    expect(afterChange.operationalDate).toBe('2026-03-08');

    const fallBack = computeOperationalDay(
      new Date('2026-11-01T06:30:00.000Z'),
      'America/New_York',
      '05:00',
    );
    expect(fallBack.localTime).toBe('01:30');
    expect(fallBack.operationalDate).toBe('2026-10-31');
  });

  it('rejects invalid configuration', () => {
    expect(() => computeOperationalDay(new Date(), 'Not/AZone', '06:00')).toThrow();
    expect(() => computeOperationalDay(new Date(), 'America/Sao_Paulo', '25:00')).toThrow();
  });
});
