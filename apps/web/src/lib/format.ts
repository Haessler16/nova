import { translate, type TranslationKey } from './i18n/dictionary';
import type { Locale } from './i18n/locale';
import type {
  CashMovementType,
  CashSessionStatus,
  CheckInRoomBlockReason,
  DocumentStatus,
  DocumentType,
  FolioLineSource,
  FolioProductCategory,
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

const RECORD_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'status.record.active',
  SUSPENDED: 'status.record.suspended',
  INVITED: 'status.record.invited',
  DISABLED: 'status.record.disabled',
};

/** Spanish labels kept for screens that are not localized yet. */
export const RECORD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: translate('es', 'status.record.active'),
  SUSPENDED: translate('es', 'status.record.suspended'),
  INVITED: translate('es', 'status.record.invited'),
  DISABLED: translate('es', 'status.record.disabled'),
};

/** Localized record status label; unknown statuses fall back to the raw value. */
export function recordStatusLabel(locale: Locale, status: string): string {
  const key = RECORD_STATUS_LABEL_KEYS[status];
  return key === undefined ? status : translate(locale, key);
}

export const RECORD_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'mint',
  SUSPENDED: 'warning',
  INVITED: 'sky',
  DISABLED: 'gray',
};

export const CHECK_IN_BLOCK_REASON_LABELS: Record<CheckInRoomBlockReason, string> = {
  ROOM_OUT_OF_SERVICE: 'Habitación fuera de servicio',
  ROOM_BLOCKED: 'Bloqueo operativo activo',
  ROOM_OCCUPIED: 'Habitación ocupada',
  ROOM_NOT_AVAILABLE: 'Otra reserva ocupa esas fechas',
  HOUSEKEEPING_NOT_READY: 'Housekeeping no lista',
};

const CHECK_IN_BLOCK_REASON_LABEL_KEYS: Record<CheckInRoomBlockReason, TranslationKey> = {
  ROOM_OUT_OF_SERVICE: 'checkIn.blockReason.outOfService',
  ROOM_BLOCKED: 'checkIn.blockReason.blocked',
  ROOM_OCCUPIED: 'checkIn.blockReason.occupied',
  ROOM_NOT_AVAILABLE: 'checkIn.blockReason.notAvailable',
  HOUSEKEEPING_NOT_READY: 'checkIn.blockReason.housekeeping',
};

/** Localized reason a room cannot take a check-in. */
export function checkInBlockReasonLabel(locale: Locale, reason: CheckInRoomBlockReason): string {
  return translate(locale, CHECK_IN_BLOCK_REASON_LABEL_KEYS[reason]);
}

export const FOLIO_LINE_SOURCE_LABELS: Record<FolioLineSource, string> = {
  MANUAL: 'Manual',
  MINIBAR: 'Minibar',
  FRONT_DESK: 'Recepción',
  PARKING: 'Estacionamiento',
  SERVICE: 'Servicio',
  INTEGRATION: 'Integración',
};

export const PRODUCT_CATEGORY_LABELS: Record<FolioProductCategory, string> = {
  MINIBAR: 'Minibar',
  FOOD_BEVERAGE: 'Alimentos y bebidas',
  PARKING: 'Estacionamiento',
  LAUNDRY: 'Lavandería',
  SERVICE: 'Servicios',
  OTHER: 'Otros',
};

export const HOUSEKEEPING_LABELS: Record<HousekeepingState, string> = {
  DIRTY: 'Sucia',
  CLEANING: 'En limpieza',
  CLEAN: 'Limpia',
  INSPECTED: 'Inspeccionada',
};

const HOUSEKEEPING_LABEL_KEYS: Record<HousekeepingState, TranslationKey> = {
  DIRTY: 'housekeeping.dirty',
  CLEANING: 'housekeeping.cleaning',
  CLEAN: 'housekeeping.clean',
  INSPECTED: 'housekeeping.inspected',
};

/** Localized housekeeping state. */
export function housekeepingLabel(locale: Locale, state: HousekeepingState): string {
  return translate(locale, HOUSEKEEPING_LABEL_KEYS[state]);
}

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

const OPERATIONAL_LABEL_KEYS: Record<RoomOperationalState, TranslationKey> = {
  AVAILABLE: 'operational.available',
  OUT_OF_ORDER: 'operational.outOfOrder',
  OUT_OF_SERVICE: 'operational.outOfService',
};

/** Localized operational state of a room. */
export function roomOperationalLabel(locale: Locale, state: RoomOperationalState): string {
  return translate(locale, OPERATIONAL_LABEL_KEYS[state]);
}

export const OPERATIONAL_COLORS: Record<RoomOperationalState, string> = {
  AVAILABLE: 'mint',
  OUT_OF_ORDER: 'danger',
  OUT_OF_SERVICE: 'warning',
};

export const OCCUPANCY_LABELS = {
  VACANT: 'Libre',
  OCCUPIED: 'Ocupada',
} as const;

const OCCUPANCY_LABEL_KEYS: Record<'VACANT' | 'OCCUPIED', TranslationKey> = {
  VACANT: 'room.occupancy.vacant',
  OCCUPIED: 'room.occupancy.occupied',
};

/** Localized occupancy label (room rack, move candidates). */
export function occupancyLabel(locale: Locale, occupancy: 'VACANT' | 'OCCUPIED'): string {
  return translate(locale, OCCUPANCY_LABEL_KEYS[occupancy]);
}

export const OCCUPANCY_COLORS = {
  VACANT: 'mint',
  OCCUPIED: 'brand',
} as const;

export const BLOCK_TYPE_LABELS: Record<RoomBlockType, string> = {
  OUT_OF_ORDER: 'Fuera de orden',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export const BLOCK_STATUS_LABELS: Record<RoomBlockStatus, string> = {
  ACTIVE: 'Activo',
  RELEASED: 'Liberado',
  EXPIRED: 'Expirado',
};

const RESERVATION_STATUS_LABEL_KEYS: Record<ReservationStatus, TranslationKey> = {
  CONFIRMED: 'reservation.status.confirmed',
  CHECKED_IN: 'reservation.status.checkedIn',
  CHECKED_OUT: 'reservation.status.checkedOut',
  CANCELLED: 'reservation.status.cancelled',
  NO_SHOW: 'reservation.status.noShow',
};

/** Spanish labels kept for screens that are not localized yet. */
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: translate('es', 'reservation.status.confirmed'),
  CHECKED_IN: translate('es', 'reservation.status.checkedIn'),
  CHECKED_OUT: translate('es', 'reservation.status.checkedOut'),
  CANCELLED: translate('es', 'reservation.status.cancelled'),
  NO_SHOW: translate('es', 'reservation.status.noShow'),
};

/** Localized reservation status label. */
export function reservationStatusLabel(locale: Locale, status: ReservationStatus): string {
  const key = RESERVATION_STATUS_LABEL_KEYS[status];
  return key === undefined ? status : translate(locale, key);
}

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  CONFIRMED: 'sky',
  CHECKED_IN: 'mint',
  CHECKED_OUT: 'brand',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

/** Document types in the order the forms list them. */
export const DOCUMENT_TYPES: GuestDocumentType[] = [
  'CPF',
  'PASSPORT',
  'RG',
  'NATIONAL_ID',
  'DRIVER_LICENSE',
  'OTHER',
];

const DOCUMENT_TYPE_LABEL_KEYS: Record<GuestDocumentType, TranslationKey> = {
  CPF: 'documentType.cpf',
  PASSPORT: 'documentType.passport',
  RG: 'documentType.rg',
  NATIONAL_ID: 'documentType.nationalId',
  DRIVER_LICENSE: 'documentType.driverLicense',
  OTHER: 'documentType.other',
};

/** Spanish labels kept for screens that are not localized yet. */
export const DOCUMENT_TYPE_LABELS: Record<GuestDocumentType, string> = {
  CPF: translate('es', 'documentType.cpf'),
  PASSPORT: translate('es', 'documentType.passport'),
  RG: translate('es', 'documentType.rg'),
  NATIONAL_ID: translate('es', 'documentType.nationalId'),
  DRIVER_LICENSE: translate('es', 'documentType.driverLicense'),
  OTHER: translate('es', 'documentType.other'),
};

/** Localized guest document-type label. */
export function documentTypeLabel(locale: Locale, type: GuestDocumentType): string {
  return translate(locale, DOCUMENT_TYPE_LABEL_KEYS[type]);
}

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

const INCIDENT_TYPE_LABEL_KEYS: Record<IncidentType, TranslationKey> = {
  NOTE: 'incident.type.note',
  MAINTENANCE: 'incident.type.maintenance',
  COMPLAINT: 'incident.type.complaint',
  SAFETY: 'incident.type.safety',
  OTHER: 'incident.type.other',
};

/** Localized incident type. */
export function incidentTypeLabel(locale: Locale, type: IncidentType): string {
  return translate(locale, INCIDENT_TYPE_LABEL_KEYS[type]);
}

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
};

const INCIDENT_SEVERITY_LABEL_KEYS: Record<IncidentSeverity, TranslationKey> = {
  LOW: 'incident.severity.low',
  MEDIUM: 'incident.severity.medium',
  HIGH: 'incident.severity.high',
};

/** Localized incident severity. */
export function incidentSeverityLabel(locale: Locale, severity: IncidentSeverity): string {
  return translate(locale, INCIDENT_SEVERITY_LABEL_KEYS[severity]);
}

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  LOW: 'sky',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
};

const INCIDENT_STATUS_LABEL_KEYS: Record<IncidentStatus, TranslationKey> = {
  OPEN: 'incident.status.open',
  RESOLVED: 'incident.status.resolved',
};

/** Localized incident status. */
export function incidentStatusLabel(locale: Locale, status: IncidentStatus): string {
  return translate(locale, INCIDENT_STATUS_LABEL_KEYS[status]);
}

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

const CALENDAR_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function formatCalendarDate(value: string): string {
  if (!CALENDAR_DATE_SHAPE.test(value)) {
    return value;
  }
  const [year, month, day] = value.split('-');
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

/**
 * Calendar date (`YYYY-MM-DD`) for an instant in a property timezone.
 * Use it for "today" defaults; never for values that are already calendar
 * dates (`YYYY-MM-DD`), which are timezone-independent.
 */
export function calendarDateInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function localCalendarDate(instant: Date): string {
  const year = instant.getFullYear();
  const month = String(instant.getMonth() + 1).padStart(2, '0');
  const day = String(instant.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Today as a calendar date. Pass the property timezone whenever it is known;
 * the browser-local date is only a fallback before the session is loaded.
 */
export function todayISO(offsetDays = 0, timezone?: string): string {
  const base =
    timezone !== undefined
      ? calendarDateInTimezone(new Date(), timezone)
      : localCalendarDate(new Date());
  return addDaysISO(base, offsetDays);
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

const RESERVATION_DOCUMENT_LABEL_KEYS: Record<DocumentType, TranslationKey> = {
  GUEST_REGISTRATION: 'document.type.guestRegistration',
  LODGING_TERMS: 'document.type.lodgingTerms',
  CHECKIN_SUMMARY: 'document.type.checkinSummary',
};

/** Spanish labels kept for screens that are not localized yet. */
export const RESERVATION_DOCUMENT_LABELS: Record<DocumentType, string> = {
  GUEST_REGISTRATION: translate('es', 'document.type.guestRegistration'),
  LODGING_TERMS: translate('es', 'document.type.lodgingTerms'),
  CHECKIN_SUMMARY: translate('es', 'document.type.checkinSummary'),
};

/** Localized reservation document-type label. */
export function reservationDocumentLabel(locale: Locale, type: DocumentType): string {
  return translate(locale, RESERVATION_DOCUMENT_LABEL_KEYS[type]);
}

const DOCUMENT_STATUS_LABEL_KEYS: Record<DocumentStatus, TranslationKey> = {
  GENERATED: 'document.status.generated',
  SIGNATURE_RECEIVED: 'document.status.signatureReceived',
  VOIDED: 'document.status.voided',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  GENERATED: translate('es', 'document.status.generated'),
  SIGNATURE_RECEIVED: translate('es', 'document.status.signatureReceived'),
  VOIDED: translate('es', 'document.status.voided'),
};

/** Localized generated-document status label. */
export function documentStatusLabel(locale: Locale, status: DocumentStatus): string {
  return translate(locale, DOCUMENT_STATUS_LABEL_KEYS[status]);
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  GENERATED: 'sky',
  SIGNATURE_RECEIVED: 'mint',
  VOIDED: 'danger',
};

const INSTRUCTION_CATEGORY_LABEL_KEYS: Record<InstructionCategory, TranslationKey> = {
  PAYMENT: 'instruction.category.payment',
  MEAL: 'instruction.category.meal',
  BILLING: 'instruction.category.billing',
  ROOM: 'instruction.category.room',
  ARRIVAL: 'instruction.category.arrival',
  IMPORTANT: 'instruction.category.important',
  EXTRA: 'instruction.category.extra',
  CONFIDENTIAL: 'instruction.category.confidential',
  GENERAL: 'instruction.category.general',
};

/** Spanish labels kept for screens that are not localized yet. */
export const INSTRUCTION_CATEGORY_LABELS: Record<InstructionCategory, string> = {
  PAYMENT: translate('es', 'instruction.category.payment'),
  MEAL: translate('es', 'instruction.category.meal'),
  BILLING: translate('es', 'instruction.category.billing'),
  ROOM: translate('es', 'instruction.category.room'),
  ARRIVAL: translate('es', 'instruction.category.arrival'),
  IMPORTANT: translate('es', 'instruction.category.important'),
  EXTRA: translate('es', 'instruction.category.extra'),
  CONFIDENTIAL: translate('es', 'instruction.category.confidential'),
  GENERAL: translate('es', 'instruction.category.general'),
};

/** Localized instruction category label. */
export function instructionCategoryLabel(locale: Locale, category: InstructionCategory): string {
  return translate(locale, INSTRUCTION_CATEGORY_LABEL_KEYS[category]);
}

const INSTRUCTION_PRIORITY_LABEL_KEYS: Record<InstructionPriority, TranslationKey> = {
  LOW: 'instruction.priority.low',
  NORMAL: 'instruction.priority.normal',
  HIGH: 'instruction.priority.high',
  CRITICAL: 'instruction.priority.critical',
};

export const INSTRUCTION_PRIORITY_LABELS: Record<InstructionPriority, string> = {
  LOW: translate('es', 'instruction.priority.low'),
  NORMAL: translate('es', 'instruction.priority.normal'),
  HIGH: translate('es', 'instruction.priority.high'),
  CRITICAL: translate('es', 'instruction.priority.critical'),
};

/** Localized instruction priority label. */
export function instructionPriorityLabel(locale: Locale, priority: InstructionPriority): string {
  return translate(locale, INSTRUCTION_PRIORITY_LABEL_KEYS[priority]);
}

export const INSTRUCTION_PRIORITY_COLORS: Record<InstructionPriority, string> = {
  LOW: 'gray',
  NORMAL: 'sky',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const INSTRUCTION_STATUS_LABEL_KEYS: Record<InstructionStatus, TranslationKey> = {
  NEW: 'instruction.status.new',
  ACKNOWLEDGED: 'instruction.status.acknowledged',
  IN_PROGRESS: 'instruction.status.inProgress',
  COMPLETED: 'instruction.status.completed',
  DISMISSED: 'instruction.status.dismissed',
  NEEDS_CLARIFICATION: 'instruction.status.needsClarification',
};

export const INSTRUCTION_STATUS_LABELS: Record<InstructionStatus, string> = {
  NEW: translate('es', 'instruction.status.new'),
  ACKNOWLEDGED: translate('es', 'instruction.status.acknowledged'),
  IN_PROGRESS: translate('es', 'instruction.status.inProgress'),
  COMPLETED: translate('es', 'instruction.status.completed'),
  DISMISSED: translate('es', 'instruction.status.dismissed'),
  NEEDS_CLARIFICATION: translate('es', 'instruction.status.needsClarification'),
};

/** Localized instruction status label. */
export function instructionStatusLabel(locale: Locale, status: InstructionStatus): string {
  return translate(locale, INSTRUCTION_STATUS_LABEL_KEYS[status]);
}

export const INSTRUCTION_STATUS_COLORS: Record<InstructionStatus, string> = {
  NEW: 'sky',
  ACKNOWLEDGED: 'brand',
  IN_PROGRESS: 'warning',
  COMPLETED: 'mint',
  DISMISSED: 'gray',
  NEEDS_CLARIFICATION: 'danger',
};

const INSTRUCTION_ACTION_LABEL_KEYS: Record<InstructionActionType, TranslationKey> = {
  PAYMENT_PREAUTHORIZATION: 'instruction.action.preauthorization',
  VERIFY_PAYMENT: 'instruction.action.verifyPayment',
  BILLING_TASK: 'instruction.action.billingTask',
  ARRIVAL_REMINDER: 'instruction.action.arrivalReminder',
};

export const INSTRUCTION_ACTION_LABELS: Record<InstructionActionType, string> = {
  PAYMENT_PREAUTHORIZATION: translate('es', 'instruction.action.preauthorization'),
  VERIFY_PAYMENT: translate('es', 'instruction.action.verifyPayment'),
  BILLING_TASK: translate('es', 'instruction.action.billingTask'),
  ARRIVAL_REMINDER: translate('es', 'instruction.action.arrivalReminder'),
};

/** Localized instruction action label. */
export function instructionActionLabel(locale: Locale, action: InstructionActionType): string {
  return translate(locale, INSTRUCTION_ACTION_LABEL_KEYS[action]);
}

const INSTRUCTION_MOMENT_LABEL_KEYS: Record<InstructionExecutionMoment, TranslationKey> = {
  PRE_ARRIVAL: 'instruction.moment.preArrival',
  CHECK_IN: 'instruction.moment.checkIn',
  DURING_STAY: 'instruction.moment.duringStay',
  CHECK_OUT: 'instruction.moment.checkOut',
};

export const INSTRUCTION_MOMENT_LABELS: Record<InstructionExecutionMoment, string> = {
  PRE_ARRIVAL: translate('es', 'instruction.moment.preArrival'),
  CHECK_IN: translate('es', 'instruction.moment.checkIn'),
  DURING_STAY: translate('es', 'instruction.moment.duringStay'),
  CHECK_OUT: translate('es', 'instruction.moment.checkOut'),
};

/** Localized instruction execution moment label. */
export function instructionMomentLabel(locale: Locale, moment: InstructionExecutionMoment): string {
  return translate(locale, INSTRUCTION_MOMENT_LABEL_KEYS[moment]);
}

const INSTRUCTION_VISIBILITY_LABEL_KEYS: Record<InstructionVisibility, TranslationKey> = {
  ALL_AUTHORIZED: 'instruction.visibility.allAuthorized',
  FRONT_DESK: 'instruction.visibility.frontDesk',
  RESERVATIONS: 'instruction.visibility.reservations',
  FINANCE: 'instruction.visibility.finance',
  MANAGEMENT: 'instruction.visibility.management',
};

export const INSTRUCTION_VISIBILITY_LABELS: Record<InstructionVisibility, string> = {
  ALL_AUTHORIZED: translate('es', 'instruction.visibility.allAuthorized'),
  FRONT_DESK: translate('es', 'instruction.visibility.frontDesk'),
  RESERVATIONS: translate('es', 'instruction.visibility.reservations'),
  FINANCE: translate('es', 'instruction.visibility.finance'),
  MANAGEMENT: translate('es', 'instruction.visibility.management'),
};

/** Localized instruction visibility label. */
export function instructionVisibilityLabel(
  locale: Locale,
  visibility: InstructionVisibility,
): string {
  return translate(locale, INSTRUCTION_VISIBILITY_LABEL_KEYS[visibility]);
}
