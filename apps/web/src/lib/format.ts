import type {
  CashMovementType,
  CashSessionStatus,
  DocumentStatus,
  DocumentType,
  FolioStatus,
  GuestDocumentType,
  HousekeepingState,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  InstructionActionType,
  InstructionCategory,
  InstructionExecutionMoment,
  InstructionPriority,
  InstructionStatus,
  InstructionVisibility,
  OperationalCloseStatus,
  PaymentStatus,
  ReservationStatus,
  RoomBlockStatus,
  RoomBlockType,
  RoomOperationalState,
  SecuritySeverity,
} from './types';

export const RECORD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  INVITED: 'Invitado',
  DISABLED: 'Deshabilitado',
};

export const RECORD_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'mint',
  SUSPENDED: 'warning',
  INVITED: 'sky',
  DISABLED: 'gray',
};

export const HOUSEKEEPING_LABELS: Record<HousekeepingState, string> = {
  DIRTY: 'Sucia',
  CLEANING: 'En limpieza',
  CLEAN: 'Limpia',
  INSPECTED: 'Inspeccionada',
};

export const HOUSEKEEPING_COLORS: Record<HousekeepingState, string> = {
  DIRTY: 'danger',
  CLEANING: 'warning',
  CLEAN: 'sky',
  INSPECTED: 'mint',
};

export const OPERATIONAL_LABELS: Record<RoomOperationalState, string> = {
  AVAILABLE: 'Disponible',
  OUT_OF_ORDER: 'Fuera de orden',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export const OPERATIONAL_COLORS: Record<RoomOperationalState, string> = {
  AVAILABLE: 'mint',
  OUT_OF_ORDER: 'danger',
  OUT_OF_SERVICE: 'warning',
};

export const BLOCK_TYPE_LABELS: Record<RoomBlockType, string> = {
  OUT_OF_ORDER: 'Fuera de orden',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export const BLOCK_STATUS_LABELS: Record<RoomBlockStatus, string> = {
  ACTIVE: 'Activo',
  RELEASED: 'Liberado',
  EXPIRED: 'Expirado',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En casa',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No-show',
};

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  CONFIRMED: 'sky',
  CHECKED_IN: 'mint',
  CHECKED_OUT: 'brand',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

export const DOCUMENT_TYPE_LABELS: Record<GuestDocumentType, string> = {
  CPF: 'CPF',
  PASSPORT: 'Pasaporte',
  RG: 'RG',
  NATIONAL_ID: 'Documento nacional',
  DRIVER_LICENSE: 'Licencia de conducir',
  OTHER: 'Otro',
};

export const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  INFO: 'sky',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  NOTE: 'Nota',
  MAINTENANCE: 'Mantenimiento',
  COMPLAINT: 'Reclamo',
  SAFETY: 'Seguridad',
  OTHER: 'Otro',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
};

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  LOW: 'sky',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
};

export const HOUSEKEEPING_TRANSITIONS: Record<HousekeepingState, HousekeepingState[]> = {
  DIRTY: ['CLEANING'],
  CLEANING: ['CLEAN', 'DIRTY'],
  CLEAN: ['INSPECTED', 'DIRTY'],
  INSPECTED: ['DIRTY'],
};

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (year === undefined || month === undefined || day === undefined) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

/** Human date for calendar values (YYYY-MM-DD), e.g. "domingo, 8 de noviembre de 2026". */
export function formatLongDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return value;
  }
  const formatted = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayShort(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

export function splitAttributes(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return JSON.stringify(value, null, 2);
}

export function formatMoney(value: string | null | undefined, currencyCode = 'BRL'): string {
  const amount = Number(value ?? '0');
  if (!Number.isFinite(amount)) {
    return `${value ?? '0'} ${currencyCode}`;
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

export const FOLIO_STATUS_LABELS: Record<FolioStatus, string> = {
  OPEN: 'Abierto',
  SETTLED: 'Saldado',
  CANCELLED: 'Cancelado',
};

export const FOLIO_STATUS_COLORS: Record<FolioStatus, string> = {
  OPEN: 'sky',
  SETTLED: 'mint',
  CANCELLED: 'danger',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  REFUNDED: 'Reintegrado',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING: 'warning',
  COMPLETED: 'mint',
  FAILED: 'danger',
  REFUNDED: 'sky',
};

export const CASH_SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
};

export const CASH_SESSION_STATUS_COLORS: Record<CashSessionStatus, string> = {
  OPEN: 'sky',
  CLOSED: 'mint',
};

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  CASH_IN: 'Ingreso',
  CASH_OUT: 'Egreso',
  REFUND: 'Reintegro',
  ADJUSTMENT: 'Ajuste (+)',
};

export const OPERATIONAL_CLOSE_LABELS: Record<OperationalCloseStatus, string> = {
  CLOSED: 'Día cerrado',
  REOPENED: 'Reabierto',
};

export const OPERATIONAL_CLOSE_COLORS: Record<OperationalCloseStatus, string> = {
  CLOSED: 'mint',
  REOPENED: 'warning',
};

export const RESERVATION_DOCUMENT_LABELS: Record<DocumentType, string> = {
  GUEST_REGISTRATION: 'Ficha de registro',
  LODGING_TERMS: 'Términos de hospedaje',
  CHECKIN_SUMMARY: 'Resumen de check-in',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  GENERATED: 'Generado',
  SIGNATURE_RECEIVED: 'Firma recibida',
  VOIDED: 'Anulado',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  GENERATED: 'sky',
  SIGNATURE_RECEIVED: 'mint',
  VOIDED: 'danger',
};

export const INSTRUCTION_CATEGORY_LABELS: Record<InstructionCategory, string> = {
  PAYMENT: 'Pago',
  MEAL: 'Alimentación',
  BILLING: 'Facturación',
  ROOM: 'Habitación',
  ARRIVAL: 'Llegada',
  IMPORTANT: 'Importante',
  EXTRA: 'Extras',
  CONFIDENTIAL: 'Confidencial',
  GENERAL: 'General',
};

export const INSTRUCTION_PRIORITY_LABELS: Record<InstructionPriority, string> = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const INSTRUCTION_PRIORITY_COLORS: Record<InstructionPriority, string> = {
  LOW: 'gray',
  NORMAL: 'sky',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

export const INSTRUCTION_STATUS_LABELS: Record<InstructionStatus, string> = {
  NEW: 'Nueva',
  ACKNOWLEDGED: 'Reconocida',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  DISMISSED: 'Descartada',
  NEEDS_CLARIFICATION: 'Necesita aclaración',
};

export const INSTRUCTION_STATUS_COLORS: Record<InstructionStatus, string> = {
  NEW: 'sky',
  ACKNOWLEDGED: 'brand',
  IN_PROGRESS: 'warning',
  COMPLETED: 'mint',
  DISMISSED: 'gray',
  NEEDS_CLARIFICATION: 'danger',
};

export const INSTRUCTION_ACTION_LABELS: Record<InstructionActionType, string> = {
  PAYMENT_PREAUTHORIZATION: 'Preautorización en check-in',
  VERIFY_PAYMENT: 'Verificar pago en ledger',
  BILLING_TASK: 'Tarea de facturación',
  ARRIVAL_REMINDER: 'Recordatorio de llegada',
};

export const INSTRUCTION_MOMENT_LABELS: Record<InstructionExecutionMoment, string> = {
  PRE_ARRIVAL: 'Antes de la llegada',
  CHECK_IN: 'Check-in',
  DURING_STAY: 'Durante la estadía',
  CHECK_OUT: 'Check-out',
};

export const INSTRUCTION_VISIBILITY_LABELS: Record<InstructionVisibility, string> = {
  ALL_AUTHORIZED: 'Todos los autorizados',
  FRONT_DESK: 'Recepción',
  RESERVATIONS: 'Reservas',
  FINANCE: 'Finanzas',
  MANAGEMENT: 'Gerencia',
};
