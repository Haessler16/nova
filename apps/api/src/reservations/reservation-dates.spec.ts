import { BadRequestException } from '@nestjs/common';
import {
  assertStayWindow,
  formatCalendarDate,
  generateReservationCode,
  nightsBetween,
  parseCalendarDate,
} from './reservation-dates';

describe('reservation calendar dates', () => {
  it('parses and formats valid calendar dates', () => {
    const date = parseCalendarDate('2027-01-05', 'checkInDate');
    expect(date.toISOString()).toBe('2027-01-05T00:00:00.000Z');
    expect(formatCalendarDate(date)).toBe('2027-01-05');
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(() => parseCalendarDate('2027-1-5', 'checkInDate')).toThrow(BadRequestException);
    expect(() => parseCalendarDate('2027-02-30', 'checkInDate')).toThrow(BadRequestException);
  });

  it('computes nights and rejects inverted or past stays', () => {
    const checkIn = parseCalendarDate('2027-01-05', 'checkInDate');
    const checkOut = parseCalendarDate('2027-01-08', 'checkOutDate');
    expect(nightsBetween(checkIn, checkOut)).toBe(3);

    expect(() => assertStayWindow(checkOut, checkIn, checkIn)).toThrow(BadRequestException);
    expect(() => assertStayWindow(checkIn, checkOut, new Date('2027-01-10T12:00:00Z'))).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertStayWindow(checkIn, checkOut, new Date('2027-01-01T00:00:00Z')),
    ).not.toThrow();
  });

  it('generates reservation codes that satisfy the database format check', () => {
    const code = generateReservationCode(parseCalendarDate('2027-01-05', 'checkInDate'));
    expect(code).toMatch(/^RES-20270105-[A-F0-9]{6}$/);
  });
});
