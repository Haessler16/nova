/**
 * Client-side validation for browser forms.
 *
 * These rules mirror the API DTOs so the operator gets immediate feedback, but
 * they are only a UX aid: the backend re-validates every request and remains
 * the authority. Keep the limits in sync with the API DTOs.
 */

export type FieldErrors = Record<string, string>;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;
export const MONEY_PATTERN = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const ROOM_TYPE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;
export const ROOM_NUMBER_PATTERN = /^[A-Za-z0-9._/-]{1,32}$/;
export const RESERVATION_CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;
export const MAX_ROOM_ATTRIBUTES = 20;
export const MAX_ATTRIBUTE_LENGTH = 64;

export const LIMITS = {
  guestName: { min: 2, max: 160 },
  guestEmail: 254,
  guestPhone: 32,
  guestDocument: { min: 3, max: 64 },
  guestNotes: 2000,
  money: '99999999.99',
} as const;

function collect(errors: FieldErrors, field: string, message: string | null): void {
  if (message !== null) {
    errors[field] = message;
  }
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Collects `[field, message|null]` pairs into an error map. */
export function buildErrors(entries: Array<[string, string | null]>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, message] of entries) {
    if (message !== null) {
      errors[field] = message;
    }
  }
  return errors;
}

export function requiredText(
  value: string,
  label: string,
  limits: { min?: number; max?: number } = {},
): string | null {
  const trimmed = value.trim();
  const min = limits.min ?? 1;
  const max = limits.max;
  if (trimmed === '') {
    return `${label} es obligatorio.`;
  }
  if (trimmed.length < min) {
    return `${label} debe tener al menos ${min} caracteres.`;
  }
  if (max !== undefined && trimmed.length > max) {
    return `${label} no puede superar ${max} caracteres.`;
  }
  return null;
}

export function optionalText(
  value: string,
  label: string,
  limits: { max?: number } = {},
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (limits.max !== undefined && trimmed.length > limits.max) {
    return `${label} no puede superar ${limits.max} caracteres.`;
  }
  return null;
}

export function emailField(value: string, options: { required?: boolean } = {}): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return options.required === true ? 'El email es obligatorio.' : null;
  }
  if (trimmed.length > LIMITS.guestEmail || !EMAIL_PATTERN.test(trimmed)) {
    return 'Ingresá un email válido (ej. nombre@dominio.com).';
  }
  return null;
}

export function phoneField(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (!PHONE_PATTERN.test(trimmed)) {
    return 'Usá sólo dígitos, espacios, paréntesis, guiones y un + inicial (6 a 32 caracteres).';
  }
  return null;
}

/**
 * Money is a decimal string with up to 2 fractional digits and 8 integer
 * digits; binary floats are never used for amounts.
 */
export function moneyField(
  value: string,
  label: string,
  options: { allowZero?: boolean } = {},
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return `${label} es obligatorio.`;
  }
  if (!MONEY_PATTERN.test(trimmed)) {
    return `${label} debe ser un importe con hasta dos decimales (ej. 150.00).`;
  }
  if (options.allowZero === false && Number(trimmed) === 0) {
    return `${label} debe ser mayor que cero.`;
  }
  return null;
}

export function calendarDateField(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return `${label} es obligatorio.`;
  }
  if (!CALENDAR_DATE_PATTERN.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    return `${label} debe ser una fecha válida (AAAA-MM-DD).`;
  }
  return null;
}

export function intField(
  value: string,
  label: string,
  limits: { min: number; max: number },
): string | null {
  const trimmed = value.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return `${label} debe ser un número entero.`;
  }
  const parsed = Number(trimmed);
  if (parsed < limits.min || parsed > limits.max) {
    return `${label} debe estar entre ${limits.min} y ${limits.max}.`;
  }
  return null;
}

export function reasonField(
  value: string,
  label = 'El motivo',
  limits: { min?: number; max?: number } = {},
): string | null {
  return requiredText(value, label, { min: limits.min ?? 3, max: limits.max ?? 500 });
}

export interface GuestFieldInput {
  fullName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  notes?: string;
}

/** Mirrors CreateGuestDto / UpdateGuestDto. */
export function validateGuest(input: GuestFieldInput): FieldErrors {
  const errors: FieldErrors = {};
  collect(errors, 'fullName', requiredText(input.fullName, 'El nombre', LIMITS.guestName));
  collect(errors, 'email', emailField(input.email));
  collect(errors, 'phone', phoneField(input.phone));
  collect(errors, 'documentNumber', validateDocument(input.documentType, input.documentNumber));
  if (input.notes !== undefined) {
    collect(errors, 'notes', optionalText(input.notes, 'Las notas', { max: LIMITS.guestNotes }));
  }
  return errors;
}

/** Mirrors the reservation DTO's calendar-date range validation. */
export function dateRangeField(
  checkIn: string,
  checkOut: string,
  options: { maxNights?: number } = {},
): string | null {
  if (
    checkIn === '' ||
    checkOut === '' ||
    !CALENDAR_DATE_PATTERN.test(checkIn) ||
    !CALENDAR_DATE_PATTERN.test(checkOut)
  ) {
    return null;
  }
  if (checkOut <= checkIn) {
    return 'El check-out debe ser posterior al check-in.';
  }
  const nights = Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000,
  );
  const maxNights = options.maxNights ?? 366;
  if (!Number.isFinite(nights) || nights < 1 || nights > maxNights) {
    return `La estadía debe tener entre 1 y ${maxNights} noches.`;
  }
  return null;
}

/** Optional uppercase reservation code (4-32 letters, digits or hyphens). */
export function reservationCodeField(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (code === '') {
    return null;
  }
  return RESERVATION_CODE_PATTERN.test(code)
    ? null
    : 'El código debe tener 4–32 mayúsculas, números o guiones.';
}

/** Comma-separated room attributes: at most 20 items of 64 characters. */
export function attributesField(value: string): string | null {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length > MAX_ROOM_ATTRIBUTES) {
    return `Máximo ${MAX_ROOM_ATTRIBUTES} atributos.`;
  }
  if (items.some((item) => item.length > MAX_ATTRIBUTE_LENGTH)) {
    return `Cada atributo admite hasta ${MAX_ATTRIBUTE_LENGTH} caracteres.`;
  }
  return null;
}

export function datetimeLocalField(value: string, label: string): string | null {
  if (value.trim() === '') {
    return `${label} es obligatorio.`;
  }
  if (!DATE_TIME_LOCAL_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    return `${label} debe ser una fecha y hora válidas.`;
  }
  return null;
}

/** Mirrors the room-block interval rules (end strictly after start). */
export function blockRangeField(startsAt: string, endsAt: string): string | null {
  if (
    startsAt === '' ||
    endsAt === '' ||
    !DATE_TIME_LOCAL_PATTERN.test(startsAt) ||
    !DATE_TIME_LOCAL_PATTERN.test(endsAt)
  ) {
    return null;
  }
  return endsAt > startsAt ? null : 'El fin del bloqueo debe ser posterior al inicio.';
}

/** Mirrors CreateRoomTypeDto / UpdateRoomTypeDto. */
export function validateRoomType(input: {
  name: string;
  code: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  bedType: string;
  codeLocked?: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  collect(errors, 'name', requiredText(input.name, 'El nombre', { min: 1, max: 120 }));
  if (input.codeLocked !== true) {
    const code = input.code.trim();
    collect(
      errors,
      'code',
      code === ''
        ? 'El código es obligatorio.'
        : ROOM_TYPE_CODE_PATTERN.test(code)
          ? null
          : 'El código debe tener 1–24 letras, números, guiones o guiones bajos.',
    );
  }
  collect(errors, 'description', optionalText(input.description, 'La descripción', { max: 500 }));
  collect(
    errors,
    'capacityAdults',
    intField(input.capacityAdults, 'La capacidad de adultos', { min: 1, max: 50 }),
  );
  collect(
    errors,
    'capacityChildren',
    intField(input.capacityChildren, 'La capacidad de menores', { min: 0, max: 50 }),
  );
  collect(errors, 'bedType', optionalText(input.bedType, 'El tipo de cama', { max: 64 }));
  return errors;
}

/** Mirrors CreateRoomDto / UpdateRoomDto. */
export function validateRoom(input: {
  number: string;
  roomTypeId: string;
  floor: string;
  building: string;
  attributes: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const number = input.number.trim();
  collect(
    errors,
    'number',
    number === ''
      ? 'El número es obligatorio.'
      : ROOM_NUMBER_PATTERN.test(number)
        ? null
        : 'Hasta 32 letras, números, puntos, guiones, guiones bajos o barras.',
  );
  if (input.roomTypeId.trim() === '') {
    errors.roomTypeId = 'Elegí un tipo de habitación.';
  }
  collect(errors, 'floor', optionalText(input.floor, 'El piso', { max: 32 }));
  collect(errors, 'building', optionalText(input.building, 'El edificio', { max: 64 }));
  collect(errors, 'attributes', attributesField(input.attributes));
  return errors;
}

function validateDocument(documentType: string, documentNumber: string): string | null {
  if (documentType === '') {
    return null;
  }
  return requiredText(documentNumber, 'El número de documento', LIMITS.guestDocument);
}
