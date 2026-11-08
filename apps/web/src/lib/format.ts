import type {
  GuestDocumentType,
  HousekeepingState,
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
  ACTIVE: 'green',
  SUSPENDED: 'orange',
  INVITED: 'blue',
  DISABLED: 'gray',
};

export const HOUSEKEEPING_LABELS: Record<HousekeepingState, string> = {
  DIRTY: 'Sucia',
  CLEANING: 'En limpieza',
  CLEAN: 'Limpia',
  INSPECTED: 'Inspeccionada',
};

export const HOUSEKEEPING_COLORS: Record<HousekeepingState, string> = {
  DIRTY: 'red',
  CLEANING: 'orange',
  CLEAN: 'blue',
  INSPECTED: 'green',
};

export const OPERATIONAL_LABELS: Record<RoomOperationalState, string> = {
  AVAILABLE: 'Disponible',
  OUT_OF_ORDER: 'Fuera de orden',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export const OPERATIONAL_COLORS: Record<RoomOperationalState, string> = {
  AVAILABLE: 'green',
  OUT_OF_ORDER: 'red',
  OUT_OF_SERVICE: 'orange',
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
  CONFIRMED: 'blue',
  CHECKED_IN: 'green',
  CHECKED_OUT: 'purple',
  CANCELLED: 'red',
  NO_SHOW: 'orange',
};

export const DOCUMENT_TYPE_LABELS: Record<GuestDocumentType, string> = {
  PASSPORT: 'Pasaporte',
  NATIONAL_ID: 'Documento nacional',
  DRIVER_LICENSE: 'Licencia de conducir',
  OTHER: 'Otro',
};

export const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  INFO: 'blue',
  WARNING: 'orange',
  CRITICAL: 'red',
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

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
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
