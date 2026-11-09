export enum FolioStatus {
  PENDING = 'PENDING',
  CHARGED = 'CHARGED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum CashSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementType {
  OPENING = 'OPENING',
  CLOSING = 'CLOSING',
  SALE = 'SALE',
  REFUND = 'REFUND',
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}