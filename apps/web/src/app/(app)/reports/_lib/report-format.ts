import { formatCalendarDate, formatMoney } from '@/lib/format';
import type { ReportCellFormat, ReportSummaryItem } from '@/lib/types';

export function formatCell(
  value: string | number | null | undefined,
  format: ReportCellFormat,
  currencyCode: string,
): string {
  if (value === null || value === undefined || value === '' || value === '—') {
    return '—';
  }
  if (format === 'currency') {
    return formatMoney(String(value), currencyCode);
  }
  if (format === 'percent') {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toFixed(2)}%` : String(value);
  }
  if (format === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount)
      : String(value);
  }
  if (format === 'date') {
    return formatCalendarDate(String(value));
  }
  return String(value);
}

export function formatSummary(item: ReportSummaryItem, currencyCode: string): string {
  if (item.value === null) {
    return '—';
  }
  return formatCell(item.value, item.format, currencyCode);
}

export function formatZonedDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}
