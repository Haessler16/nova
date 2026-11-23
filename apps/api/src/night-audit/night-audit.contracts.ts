import { OperationalCloseStatus, Prisma } from '@prisma/client';

export const OPERATIONAL_CLOSE_SELECT = Prisma.validator<Prisma.OperationalCloseSelect>()({
  id: true,
  operationalDate: true,
  status: true,
  snapshot: true,
  notes: true,
  closedByUserId: true,
  closedAt: true,
  reopenedByUserId: true,
  reopenedAt: true,
  reopenReason: true,
  createdAt: true,
  updatedAt: true,
});

export type OperationalCloseRow = Prisma.OperationalCloseGetPayload<{
  select: typeof OPERATIONAL_CLOSE_SELECT;
}>;

export interface NightAuditBlocker {
  code: string;
  count: number;
  message: string;
}

export interface NightAuditSnapshot {
  generatedAt: string;
  operationalDate: string;
  timezone: string;
  operationalDayStart: string;
  currencyCode: string;
  counts: {
    openCashSessions: number;
    openFolios: number;
    confirmedArrivalsBeforeDate: number;
    inHousePastCheckout: number;
  };
  totals: {
    openFolioBalance: string;
  };
  blockers: NightAuditBlocker[];
  forced: boolean;
}

export interface OperationalCloseResponse {
  id: string;
  operationalDate: string;
  status: OperationalCloseStatus;
  snapshot: Prisma.JsonValue;
  notes: string | null;
  closedByUserId: string | null;
  closedAt: Date;
  reopenedByUserId: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NightAuditProperty {
  timezone: string;
  operationalDayStart: string;
  currencyCode: string;
}

export function mapClose(row: OperationalCloseRow): OperationalCloseResponse {
  return {
    id: row.id,
    operationalDate: row.operationalDate.toISOString().slice(0, 10),
    status: row.status,
    snapshot: row.snapshot,
    notes: row.notes,
    closedByUserId: row.closedByUserId,
    closedAt: row.closedAt,
    reopenedByUserId: row.reopenedByUserId,
    reopenedAt: row.reopenedAt,
    reopenReason: row.reopenReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
