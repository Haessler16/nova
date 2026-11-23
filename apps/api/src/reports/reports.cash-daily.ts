import { Prisma } from '@prisma/client';
import { money } from '../common/money/decimal';
import { addCalendarDays, propertyDayBounds } from '../common/time/property-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReportProperty } from './report-definitions';
import {
  MAX_ROWS,
  type BuiltReport,
  assertWithinLimit,
  calendarDate,
  calendarDayCount,
  localDate,
} from './reports.support';

const ZERO = new Prisma.Decimal(0);

interface CashSessionRow {
  id: string;
  name: string;
  status: string;
  operationalDate: Date;
  openingAmount: Prisma.Decimal;
  expectedCashAmount: Prisma.Decimal | null;
  closingAmount: Prisma.Decimal | null;
}

interface CashData {
  sessions: CashSessionRow[];
  movementBySession: Map<string, Map<string, Prisma.Decimal>>;
  paymentsByDate: Map<string, Map<string, Prisma.Decimal>>;
}

interface CashDay {
  row: Record<string, string | number | null>;
  opening: Prisma.Decimal;
  cashIn: Prisma.Decimal;
  cashOut: Prisma.Decimal;
  payments: Prisma.Decimal;
  variance: Prisma.Decimal;
  hasVariance: boolean;
  openSessions: number;
}

interface CashTotals {
  opening: Prisma.Decimal;
  cashIn: Prisma.Decimal;
  cashOut: Prisma.Decimal;
  payments: Prisma.Decimal;
  variance: Prisma.Decimal;
  hasVariance: boolean;
  openSessions: number;
}

export async function buildCashDailyReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
  fromDate: Date,
  toDate: Date,
): Promise<BuiltReport> {
  const data = await fetchCashData(prisma, base.organizationId, property, filters, fromDate, toDate);
  const days: CashDay[] = [];
  const totals: CashTotals = {
    opening: ZERO,
    cashIn: ZERO,
    cashOut: ZERO,
    payments: ZERO,
    variance: ZERO,
    hasVariance: false,
    openSessions: 0,
  };

  for (let offset = 0; offset < calendarDayCount(filters.from, filters.to); offset += 1) {
    const day = buildCashDay(addCalendarDays(filters.from, offset), data);
    days.push(day);
    totals.opening = totals.opening.plus(day.opening);
    totals.cashIn = totals.cashIn.plus(day.cashIn);
    totals.cashOut = totals.cashOut.plus(day.cashOut);
    totals.payments = totals.payments.plus(day.payments);
    totals.openSessions += day.openSessions;
    if (day.hasVariance) {
      totals.hasVariance = true;
      totals.variance = totals.variance.plus(day.variance);
    }
  }

  return {
    ...base,
    summary: cashSummary(totals),
    rows: days.map((day) => day.row),
  };
}

async function fetchCashData(
  prisma: PrismaService,
  organizationId: string,
  property: ReportProperty,
  filters: { from: string; to: string },
  fromDate: Date,
  toDate: Date,
): Promise<CashData> {
  const bounds = propertyDayBounds(filters.from, filters.to, property.timezone);
  const sessions = await prisma.cashSession.findMany({
    where: {
      organizationId,
      propertyId: property.id,
      operationalDate: { gte: fromDate, lte: toDate },
    },
    take: MAX_ROWS + 1,
    orderBy: [{ operationalDate: 'asc' }, { openedAt: 'asc' }],
    select: {
      id: true,
      name: true,
      status: true,
      operationalDate: true,
      openingAmount: true,
      expectedCashAmount: true,
      closingAmount: true,
    },
  });
  assertWithinLimit(sessions.length);

  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      propertyId: property.id,
      status: 'COMPLETED',
      receivedAt: {
        ...(bounds.gte !== undefined ? { gte: bounds.gte } : {}),
        ...(bounds.lt !== undefined ? { lt: bounds.lt } : {}),
      },
    },
    take: MAX_ROWS + 1,
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    select: { amount: true, method: true, receivedAt: true },
  });
  assertWithinLimit(payments.length);

  const sessionIds = sessions.map((session) => session.id);
  const movements =
    sessionIds.length === 0
      ? []
      : await prisma.cashMovement.groupBy({
          by: ['cashSessionId', 'type'],
          where: {
            organizationId,
            propertyId: property.id,
            cashSessionId: { in: sessionIds },
          },
          _sum: { amount: true },
        });

  const movementBySession = new Map<string, Map<string, Prisma.Decimal>>();
  for (const movement of movements) {
    const byType = movementBySession.get(movement.cashSessionId) ?? new Map();
    byType.set(movement.type, movement._sum.amount ?? ZERO);
    movementBySession.set(movement.cashSessionId, byType);
  }

  const paymentsByDate = new Map<string, Map<string, Prisma.Decimal>>();
  for (const payment of payments) {
    const date = localDate(payment.receivedAt, property.timezone);
    const byMethod = paymentsByDate.get(date) ?? new Map();
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? ZERO).plus(payment.amount));
    paymentsByDate.set(date, byMethod);
  }

  return { sessions, movementBySession, paymentsByDate };
}

interface SessionTotals {
  opening: Prisma.Decimal;
  cashIn: Prisma.Decimal;
  cashOut: Prisma.Decimal;
  expected: Prisma.Decimal;
  closing: Prisma.Decimal;
  variance: Prisma.Decimal;
  hasClosing: boolean;
  hasVariance: boolean;
  openSessions: number;
}

function buildCashDay(date: string, data: CashData): CashDay {
  const daySessions = data.sessions.filter(
    (session) => calendarDate(session.operationalDate) === date,
  );
  const dayPaymentMethods = data.paymentsByDate.get(date) ?? new Map<string, Prisma.Decimal>();
  const dayPayments = [...dayPaymentMethods.values()].reduce(
    (total, amount) => total.plus(amount),
    ZERO,
  );
  const totals = sumSessions(daySessions, data.movementBySession);

  const methods = [...dayPaymentMethods.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([method, amount]) => `${method}: ${money(amount)}`)
    .join(' · ');

  return {
    opening: totals.opening,
    cashIn: totals.cashIn,
    cashOut: totals.cashOut,
    payments: dayPayments,
    variance: totals.variance,
    hasVariance: totals.hasVariance,
    openSessions: totals.openSessions,
    row: {
      date,
      session:
        daySessions.length === 0
          ? 'Sin caja'
          : daySessions.length === 1
            ? (daySessions[0]?.name ?? 'Caja')
            : `${daySessions.length} sesiones`,
      status:
        daySessions.length === 0
          ? 'Sin caja'
          : daySessions.some((session) => session.status === 'OPEN')
            ? 'Abierta'
            : 'Cerrada',
      opening: money(totals.opening),
      cashIn: money(totals.cashIn),
      cashOut: money(totals.cashOut),
      expected: money(totals.expected),
      closing: totals.hasClosing ? money(totals.closing) : '—',
      variance: totals.hasVariance ? money(totals.variance) : '—',
      paymentsTotal: money(dayPayments),
      paymentMethods: methods === '' ? '—' : methods,
    },
  };
}

function sumSessions(
  sessions: CashSessionRow[],
  movementBySession: Map<string, Map<string, Prisma.Decimal>>,
): SessionTotals {
  const totals: SessionTotals = {
    opening: ZERO,
    cashIn: ZERO,
    cashOut: ZERO,
    expected: ZERO,
    closing: ZERO,
    variance: ZERO,
    hasClosing: false,
    hasVariance: false,
    openSessions: 0,
  };

  for (const session of sessions) {
    const byType = movementBySession.get(session.id) ?? new Map<string, Prisma.Decimal>();
    const cashIn = (byType.get('CASH_IN') ?? ZERO).plus(byType.get('ADJUSTMENT') ?? ZERO);
    const cashOut = (byType.get('CASH_OUT') ?? ZERO).plus(byType.get('REFUND') ?? ZERO);
    const expected = session.expectedCashAmount ?? session.openingAmount.plus(cashIn.minus(cashOut));

    totals.opening = totals.opening.plus(session.openingAmount);
    totals.cashIn = totals.cashIn.plus(cashIn);
    totals.cashOut = totals.cashOut.plus(cashOut);
    totals.expected = totals.expected.plus(expected);
    if (session.status === 'OPEN') {
      totals.openSessions += 1;
    }
    if (session.closingAmount !== null) {
      totals.hasClosing = true;
      totals.closing = totals.closing.plus(session.closingAmount);
    }
    if (session.closingAmount !== null && session.expectedCashAmount !== null) {
      totals.hasVariance = true;
      totals.variance = totals.variance.plus(
        session.closingAmount.minus(session.expectedCashAmount),
      );
    }
  }

  return totals;
}

function cashSummary(totals: CashTotals): BuiltReport['summary'] {
  return [
    { key: 'opening', label: 'Caja inicial', value: money(totals.opening), format: 'currency' },
    {
      key: 'cashIn',
      label: 'Ingresos de efectivo',
      value: money(totals.cashIn),
      format: 'currency',
    },
    {
      key: 'cashOut',
      label: 'Egresos de efectivo',
      value: money(totals.cashOut),
      format: 'currency',
    },
    {
      key: 'netCash',
      label: 'Efectivo neto',
      value: money(totals.cashIn.minus(totals.cashOut)),
      format: 'currency',
    },
    {
      key: 'payments',
      label: 'Pagos registrados',
      value: money(totals.payments),
      format: 'currency',
    },
    { key: 'openSessions', label: 'Sesiones abiertas', value: totals.openSessions, format: 'number' },
    ...(totals.hasVariance
      ? [
          {
            key: 'variance',
            label: 'Diferencia de caja',
            value: money(totals.variance),
            format: 'currency' as const,
          },
        ]
      : []),
  ];
}
