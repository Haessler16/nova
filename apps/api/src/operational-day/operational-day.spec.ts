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

  it('rejects invalid configuration', () => {
    expect(() => computeOperationalDay(new Date(), 'Not/AZone', '06:00')).toThrow();
    expect(() => computeOperationalDay(new Date(), 'America/Sao_Paulo', '25:00')).toThrow();
  });
});
