import { FolioLineStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface FolioTotals {
  charges: Prisma.Decimal;
  payments: Prisma.Decimal;
  balance: Prisma.Decimal;
}

/**
 * Single source of truth for folio balance arithmetic: posted charges minus
 * completed payments. Voided lines and non-completed payments never count.
 * The database is the authority; this only projects the stored rows.
 */
export function computeFolioTotals(
  lines: readonly { amount: Prisma.Decimal; status: FolioLineStatus }[],
  payments: readonly { amount: Prisma.Decimal; status: PaymentStatus }[],
): FolioTotals {
  const charges = lines
    .filter((line) => line.status === FolioLineStatus.POSTED)
    .reduce((total, line) => total.plus(line.amount), new Prisma.Decimal(0));
  const paid = payments
    .filter((payment) => payment.status === PaymentStatus.COMPLETED)
    .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));

  return { charges, payments: paid, balance: charges.minus(paid) };
}
