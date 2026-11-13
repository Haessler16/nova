import { PERMISSIONS, type PermissionKey } from '../access/permissions';

export const REPORT_KEYS = [
  'occupancy',
  'arrivals',
  'departures',
  'reservations',
  'cash-daily',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export type ReportCellFormat = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime';

export interface ReportColumn {
  key: string;
  label: string;
  format: ReportCellFormat;
  align?: 'left' | 'right';
  /** Relative width for the PDF table. */
  width?: number;
}

export interface ReportSummaryItem {
  key: string;
  label: string;
  value: string | number | null;
  format: ReportCellFormat;
}

export interface ReportProperty {
  id: string;
  name: string;
  code: string;
  timezone: string;
  currencyCode: string;
}

export interface ReportResult {
  executionId: string;
  reportKey: ReportKey;
  title: string;
  description: string;
  property: ReportProperty;
  generatedAt: string;
  timezone: string;
  currencyCode: string;
  filters: { from: string; to: string };
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  category: 'Operación' | 'Reservas' | 'Finanzas';
  permission: PermissionKey;
  columns: ReportColumn[];
}

/**
 * The catalog is code-defined so a client cannot choose arbitrary SQL or
 * arbitrary columns. Each definition owns its fixed query in ReportsService.
 */
export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    key: 'occupancy',
    title: 'Ocupación',
    description:
      'Noches-cuarto ocupadas, vendibles y fuera de servicio por día. La ocupación se mide al cierre de cada día de la propiedad.',
    category: 'Operación',
    permission: PERMISSIONS.REPORTS_READ,
    columns: [
      { key: 'date', label: 'Fecha', format: 'date', width: 1.1 },
      { key: 'totalRooms', label: 'Habitaciones', format: 'number', align: 'right', width: 1 },
      {
        key: 'outOfService',
        label: 'Fuera de servicio',
        format: 'number',
        align: 'right',
        width: 1.2,
      },
      { key: 'sellable', label: 'Vendibles', format: 'number', align: 'right', width: 1 },
      { key: 'occupied', label: 'Ocupadas', format: 'number', align: 'right', width: 1 },
      { key: 'available', label: 'Disponibles', format: 'number', align: 'right', width: 1 },
      { key: 'occupancyRate', label: 'Ocupación %', format: 'percent', align: 'right', width: 1.1 },
    ],
  },
  {
    key: 'arrivals',
    title: 'Llegadas',
    description: 'Llegadas previstas, realizadas, pendientes, canceladas y no-show en el período.',
    category: 'Operación',
    permission: PERMISSIONS.REPORTS_READ,
    columns: [
      { key: 'date', label: 'Llegada', format: 'date', width: 0.9 },
      { key: 'code', label: 'Reserva', format: 'text', width: 1 },
      { key: 'guest', label: 'Huésped', format: 'text', width: 2 },
      { key: 'roomType', label: 'Tipo', format: 'text', width: 1 },
      { key: 'room', label: 'Habitación', format: 'text', width: 1 },
      { key: 'nights', label: 'Noches', format: 'number', align: 'right', width: 0.7 },
      { key: 'status', label: 'Estado', format: 'text', width: 1 },
      { key: 'checkedInAt', label: 'Check-in', format: 'datetime', width: 1.1 },
    ],
  },
  {
    key: 'departures',
    title: 'Salidas',
    description: 'Salidas previstas, concluidas y pendientes, con la hora local del check-out.',
    category: 'Operación',
    permission: PERMISSIONS.REPORTS_READ,
    columns: [
      { key: 'date', label: 'Salida', format: 'date', width: 0.9 },
      { key: 'code', label: 'Reserva', format: 'text', width: 1 },
      { key: 'guest', label: 'Huésped', format: 'text', width: 2 },
      { key: 'roomType', label: 'Tipo', format: 'text', width: 1 },
      { key: 'room', label: 'Habitación', format: 'text', width: 1 },
      { key: 'status', label: 'Estado', format: 'text', width: 1 },
      { key: 'checkedOutAt', label: 'Check-out', format: 'datetime', width: 1.1 },
    ],
  },
  {
    key: 'reservations',
    title: 'Reservas',
    description:
      'Reservas creadas en el período y su estado actual: confirmadas, en casa, check-out, canceladas y no-show.',
    category: 'Reservas',
    permission: PERMISSIONS.REPORTS_READ,
    columns: [
      { key: 'createdAt', label: 'Creada', format: 'datetime', width: 1.1 },
      { key: 'code', label: 'Reserva', format: 'text', width: 1 },
      { key: 'guest', label: 'Huésped', format: 'text', width: 2 },
      { key: 'roomType', label: 'Tipo', format: 'text', width: 1 },
      { key: 'checkInDate', label: 'Llegada', format: 'date', width: 0.9 },
      { key: 'checkOutDate', label: 'Salida', format: 'date', width: 0.9 },
      { key: 'nights', label: 'Noches', format: 'number', align: 'right', width: 0.7 },
      { key: 'status', label: 'Estado', format: 'text', width: 1 },
    ],
  },
  {
    key: 'cash-daily',
    title: 'Caja diaria',
    description:
      'Apertura, ingresos y egresos de efectivo, esperado, cierre, diferencia y pagos registrados por medio. Los pagos no equivalen a efectivo.',
    category: 'Finanzas',
    permission: PERMISSIONS.REPORTS_FINANCIAL,
    columns: [
      { key: 'date', label: 'Fecha', format: 'date', width: 0.9 },
      { key: 'session', label: 'Caja', format: 'text', width: 1.2 },
      { key: 'status', label: 'Estado', format: 'text', width: 0.8 },
      { key: 'opening', label: 'Apertura', format: 'currency', align: 'right', width: 0.9 },
      { key: 'cashIn', label: 'Ingresos', format: 'currency', align: 'right', width: 0.9 },
      { key: 'cashOut', label: 'Egresos', format: 'currency', align: 'right', width: 0.9 },
      { key: 'expected', label: 'Esperado', format: 'currency', align: 'right', width: 0.9 },
      { key: 'closing', label: 'Cierre', format: 'currency', align: 'right', width: 0.9 },
      { key: 'variance', label: 'Diferencia', format: 'currency', align: 'right', width: 0.9 },
      { key: 'paymentsTotal', label: 'Pagos', format: 'currency', align: 'right', width: 0.9 },
      { key: 'paymentMethods', label: 'Medios de pago', format: 'text', width: 2 },
    ],
  },
] as const;

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

export function reportDefinition(key: ReportKey): ReportDefinition {
  const definition = REPORT_DEFINITIONS.find((item) => item.key === key);
  if (definition === undefined) {
    // Guarded by isReportKey before this helper is called.
    throw new Error(`Unknown report key: ${key}`);
  }
  return definition;
}
