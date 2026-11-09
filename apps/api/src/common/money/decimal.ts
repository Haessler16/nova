import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

/**
 * Money helpers for the API boundary.
 *
 * Amounts are accepted as decimal strings and persisted as Postgres
 * DECIMAL(10,2). They are never converted to binary floating point for
 * arithmetic or storage. Currency is an explicit ISO-4217-like three-letter
 * code and must match the folio/session currency.
 */
export const MONEY_PATTERN = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseMoney(
  value: string,
  field: string,
  options: { allowZero?: boolean } = {},
): Prisma.Decimal {
  if (!MONEY_PATTERN.test(value)) {
    throw new BadRequestException({
      code: 'invalid_money_amount',
      message: `${field} must be a decimal string with up to 2 fractional digits.`,
    });
  }

  const amount = new Prisma.Decimal(value);

  if (amount.isNegative()) {
    throw new BadRequestException({
      code: 'invalid_money_amount',
      message: `${field} must not be negative.`,
    });
  }

  if (options.allowZero !== true && amount.isZero()) {
    throw new BadRequestException({
      code: 'invalid_money_amount',
      message: `${field} must be greater than zero.`,
    });
  }

  if (amount.greaterThan(new Prisma.Decimal('99999999.99'))) {
    throw new BadRequestException({
      code: 'invalid_money_amount',
      message: `${field} exceeds the supported maximum.`,
    });
  }

  return amount.toDecimalPlaces(2);
}

export function money(value: Prisma.Decimal | null | undefined): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

export function parseCalendarDate(value: string, field: string): Date {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new BadRequestException({
      code: 'invalid_calendar_date',
      message: `${field} must use YYYY-MM-DD.`,
    });
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException({
      code: 'invalid_calendar_date',
      message: `${field} is not a valid calendar date.`,
    });
  }

  return date;
}
