import { BadRequestException } from '@nestjs/common';
import type {
  ReportDefinition,
  ReportProperty,
  ReportSummaryItem,
} from './report-definitions';

export const MAX_ROWS = 5000;
export const MAX_RANGE_DAYS = 62;
export const DEFAULT_PAGE_SIZE = 50;

export interface BuiltReport {
  definition: ReportDefinition;
  organizationId: string;
  property: ReportProperty;
  generatedAt: Date;
  filters: { from: string; to: string };
  summary: ReportSummaryItem[];
  rows: Array<Record<string, string | number | null>>;
}

export function assertWithinLimit(count: number): void {
  if (count > MAX_ROWS) {
    throw new BadRequestException({
      code: 'report_execution_limit_exceeded',
      message: `El reporte supera ${MAX_ROWS} filas. Acotá el período e intentá de nuevo.`,
    });
  }
}

export function calendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function localDate(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function formatDateTime(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(value);
}

export function nights(checkInDate: Date, checkOutDate: Date): number {
  return Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000));
}

export function calendarDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
