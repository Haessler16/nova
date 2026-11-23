import {
  FolioLineSource,
  FolioLineStatus,
  FolioStatus,
  Prisma,
} from '@prisma/client';
import { money } from '../common/money/decimal';
import { computeFolioTotals } from './folio-totals';

export const LINE_SELECT = Prisma.validator<Prisma.FolioLineSelect>()({
  id: true,
  folioId: true,
  description: true,
  amount: true,
  currencyCode: true,
  status: true,
  postedAt: true,
  voidedAt: true,
  voidReason: true,
  productId: true,
  quantity: true,
  unitAmount: true,
  unit: true,
  source: true,
  createdByUserId: true,
  createdAt: true,
});

export const PAYMENT_SELECT = Prisma.validator<Prisma.PaymentSelect>()({
  id: true,
  folioId: true,
  amount: true,
  currencyCode: true,
  method: true,
  status: true,
  referenceId: true,
  description: true,
  receivedByUserId: true,
  receivedAt: true,
  createdAt: true,
});

export const FOLIO_SELECT = Prisma.validator<Prisma.FolioSelect>()({
  id: true,
  number: true,
  status: true,
  currencyCode: true,
  stayId: true,
  reservationId: true,
  notes: true,
  openedByUserId: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  lines: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: LINE_SELECT },
  payments: { orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }], select: PAYMENT_SELECT },
});

export type FolioRow = Prisma.FolioGetPayload<{ select: typeof FOLIO_SELECT }>;
export type LineRow = Prisma.FolioLineGetPayload<{ select: typeof LINE_SELECT }>;
export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;
export type Transaction = Prisma.TransactionClient;

export interface FolioTotals {
  charges: Prisma.Decimal;
  payments: Prisma.Decimal;
  balance: Prisma.Decimal;
}

export interface FolioLineResponse {
  id: string;
  description: string;
  amount: string;
  currencyCode: string;
  status: FolioLineStatus;
  postedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  productId: string | null;
  quantity: string;
  unitAmount: string | null;
  unit: string | null;
  source: FolioLineSource;
  createdByUserId: string | null;
}

export interface PaymentResponse {
  id: string;
  amount: string;
  currencyCode: string;
  method: string;
  status: string;
  referenceId: string | null;
  description: string | null;
  receivedByUserId: string | null;
  receivedAt: Date;
}

export interface FolioResponse {
  id: string;
  number: string;
  status: FolioStatus;
  currencyCode: string;
  stayId: string | null;
  reservationId: string | null;
  notes: string | null;
  openedByUserId: string | null;
  closedAt: Date | null;
  totals: { charges: string; payments: string; balance: string };
  lines: FolioLineResponse[];
  payments: PaymentResponse[];
  createdAt: Date;
  updatedAt: Date;
}

function mapLine(line: LineRow): FolioLineResponse {
  return {
    id: line.id,
    description: line.description,
    amount: money(line.amount),
    currencyCode: line.currencyCode,
    status: line.status,
    postedAt: line.postedAt,
    voidedAt: line.voidedAt,
    voidReason: line.voidReason,
    productId: line.productId,
    quantity: line.quantity.toFixed(2),
    unitAmount: line.unitAmount === null ? null : money(line.unitAmount),
    unit: line.unit,
    source: line.source,
    createdByUserId: line.createdByUserId,
  };
}

function mapPayment(payment: PaymentRow): PaymentResponse {
  return {
    id: payment.id,
    amount: money(payment.amount),
    currencyCode: payment.currencyCode,
    method: payment.method,
    status: payment.status,
    referenceId: payment.referenceId,
    description: payment.description,
    receivedByUserId: payment.receivedByUserId,
    receivedAt: payment.receivedAt,
  };
}

export function mapFolio(folio: FolioRow): FolioResponse {
  const totals = computeFolioTotals(folio.lines, folio.payments);
  return {
    id: folio.id,
    number: folio.number,
    status: folio.status,
    currencyCode: folio.currencyCode,
    stayId: folio.stayId,
    reservationId: folio.reservationId,
    notes: folio.notes,
    openedByUserId: folio.openedByUserId,
    closedAt: folio.closedAt,
    totals: {
      charges: money(totals.charges),
      payments: money(totals.payments),
      balance: money(totals.balance),
    },
    lines: folio.lines.map(mapLine),
    payments: folio.payments.map(mapPayment),
    createdAt: folio.createdAt,
    updatedAt: folio.updatedAt,
  };
}
