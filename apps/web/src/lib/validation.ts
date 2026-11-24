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
  copy?: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  const min = limits.min ?? 1;
  const max = limits.max;
  if (trimmed === '') {
    return copy === undefined ? `${label} es obligatorio.` : copy.required(label);
  }
  if (trimmed.length < min) {
    return copy?.minLength === undefined
      ? `${label} debe tener al menos ${min} caracteres.`
      : copy.minLength(label, min);
  }
  if (max !== undefined && trimmed.length > max) {
    return copy === undefined
      ? `${label} no puede superar ${max} caracteres.`
      : copy.maxLength(label, max);
  }
  return null;
}

export function optionalText(
  value: string,
  label: string,
  limits: { max?: number } = {},
  copy?: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (limits.max !== undefined && trimmed.length > limits.max) {
    return copy === undefined
      ? `${label} no puede superar ${limits.max} caracteres.`
      : copy.maxLength(label, limits.max);
  }
  return null;
}

export function emailField(
  value: string,
  options: { required?: boolean; copy?: ValidationCopy } = {},
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    if (options.required !== true) {
      return null;
    }
    return options.copy?.emailRequired ?? 'El email es obligatorio.';
  }
  if (trimmed.length > LIMITS.guestEmail || !EMAIL_PATTERN.test(trimmed)) {
    return options.copy?.emailInvalid ?? 'Ingresá un email válido (ej. nombre@dominio.com).';
  }
  return null;
}

export function phoneField(value: string, copy?: ValidationCopy): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (!PHONE_PATTERN.test(trimmed)) {
    return (
      copy?.phoneInvalid ??
      'Usá sólo dígitos, espacios, paréntesis, guiones y un + inicial (6 a 32 caracteres).'
    );
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
  copy?: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return (copy?.moneyRequired ?? ((text) => `${text} es obligatorio.`))(label);
  }
  if (!MONEY_PATTERN.test(trimmed)) {
    return (
      copy?.moneyFormat ??
      ((text) => `${text} debe ser un importe con hasta dos decimales (ej. 150.00).`)
    )(label);
  }
  if (options.allowZero === false && Number(trimmed) === 0) {
    return (copy?.moneyPositive ?? ((text) => `${text} debe ser mayor que cero.`))(label);
  }
  return null;
}

/**
 * `Date.parse` normalizes impossible dates (2026-02-31 becomes 2026-03-03), so
 * the only reliable check is a round-trip against the UTC calendar.
 */
function isRealCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function calendarDateField(
  value: string,
  label: string,
  copy?: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return copy === undefined ? `${label} es obligatorio.` : copy.required(label);
  }
  if (!isRealCalendarDate(trimmed)) {
    return copy?.date === undefined
      ? `${label} debe ser una fecha válida (AAAA-MM-DD).`
      : copy.date(label);
  }
  return null;
}

export function intField(
  value: string,
  label: string,
  limits: { min: number; max: number },
  copy?: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return copy === undefined ? `${label} debe ser un número entero.` : copy.integer(label);
  }
  const parsed = Number(trimmed);
  if (parsed < limits.min || parsed > limits.max) {
    return copy === undefined
      ? `${label} debe estar entre ${limits.min} y ${limits.max}.`
      : copy.range(label, limits.min, limits.max);
  }
  return null;
}

export function reasonField(
  value: string,
  label = 'El motivo',
  limits: { min?: number; max?: number } = {},
  copy?: ValidationCopy,
): string | null {
  return requiredText(value, label, { min: limits.min ?? 3, max: limits.max ?? 500 }, copy);
}

export interface GuestFieldInput {
  fullName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  notes?: string;
}

/** Field labels for the guest form, localizable as a block. */
export interface GuestFieldLabels {
  fullName: string;
  documentNumber: string;
  notes: string;
}

const ES_GUEST_FIELD_LABELS: GuestFieldLabels = {
  fullName: 'El nombre',
  documentNumber: 'El número de documento',
  notes: 'Las notas',
};

/**
 * Mirrors CreateGuestDto / UpdateGuestDto. Pass `copy`/`labels` from the active
 * dictionary to keep the messages in the screen's language.
 */
export function validateGuest(
  input: GuestFieldInput,
  options: { copy?: ValidationCopy; labels?: GuestFieldLabels } = {},
): FieldErrors {
  const copy = options.copy;
  const labels = options.labels ?? ES_GUEST_FIELD_LABELS;
  const errors: FieldErrors = {};
  collect(
    errors,
    'fullName',
    requiredText(input.fullName, labels.fullName, LIMITS.guestName, copy),
  );
  collect(errors, 'email', emailField(input.email, { copy }));
  collect(errors, 'phone', phoneField(input.phone, copy));
  collect(
    errors,
    'documentNumber',
    validateDocument(input.documentType, input.documentNumber, copy, labels.documentNumber),
  );
  if (input.notes !== undefined) {
    collect(
      errors,
      'notes',
      optionalText(input.notes, labels.notes, { max: LIMITS.guestNotes }, copy),
    );
  }
  return errors;
}

/** Mirrors the reservation DTO's calendar-date range validation. */
export function dateRangeField(
  checkIn: string,
  checkOut: string,
  options: { maxNights?: number; copy?: ValidationCopy } = {},
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
    return options.copy?.dateOrder ?? 'El check-out debe ser posterior al check-in.';
  }
  const nights = Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000,
  );
  const maxNights = options.maxNights ?? 366;
  if (!Number.isFinite(nights) || nights < 1 || nights > maxNights) {
    return options.copy?.nights === undefined
      ? `La estadía debe tener entre 1 y ${maxNights} noches.`
      : options.copy.nights(maxNights);
  }
  return null;
}

/** Optional uppercase reservation code (4-32 letters, digits or hyphens). */
export function reservationCodeField(value: string, copy?: ValidationCopy): string | null {
  const code = value.trim().toUpperCase();
  if (code === '') {
    return null;
  }
  return RESERVATION_CODE_PATTERN.test(code)
    ? null
    : (copy?.code ?? 'El código debe tener 4–32 mayúsculas, números o guiones.');
}

/** Comma-separated room attributes: at most 20 items of 64 characters. */
export interface AttributeMessages {
  tooMany: (max: number) => string;
  tooLong: (max: number) => string;
}

const ES_ATTRIBUTE_MESSAGES: AttributeMessages = {
  tooMany: (max) => `Máximo ${max} atributos.`,
  tooLong: (max) => `Cada atributo admite hasta ${max} caracteres.`,
};

export function attributesField(
  value: string,
  messages: AttributeMessages = ES_ATTRIBUTE_MESSAGES,
): string | null {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length > MAX_ROOM_ATTRIBUTES) {
    return messages.tooMany(MAX_ROOM_ATTRIBUTES);
  }
  if (items.some((item) => item.length > MAX_ATTRIBUTE_LENGTH)) {
    return messages.tooLong(MAX_ATTRIBUTE_LENGTH);
  }
  return null;
}

export function datetimeLocalField(
  value: string,
  label: string,
  copy?: ValidationCopy,
): string | null {
  if (value.trim() === '') {
    return copy === undefined ? `${label} es obligatorio.` : copy.required(label);
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

/**
 * Message templates for validators that a localized screen can substitute.
 * The Spanish templates below are the historical output and stay the default,
 * so unmigrated screens keep their exact copy.
 */
export interface ValidationCopy {
  required: (label: string) => string;
  maxLength: (label: string, max: number) => string;
  integer: (label: string) => string;
  range: (label: string, min: number, max: number) => string;
  /**
   * Extra templates used by the reservation/guest validators. They are optional:
   * omitting them keeps the historical Spanish message for that rule.
   */
  minLength?: (label: string, min: number) => string;
  date?: (label: string) => string;
  dateOrder?: string;
  nights?: (max: number) => string;
  code?: string;
  emailRequired?: string;
  emailInvalid?: string;
  phoneInvalid?: string;
  moneyRequired?: (label: string) => string;
  moneyFormat?: (label: string) => string;
  moneyPositive?: (label: string) => string;
}

const ES_VALIDATION_COPY: ValidationCopy = {
  required: (label) => `${label} es obligatorio.`,
  maxLength: (label, max) => `${label} no puede superar ${max} caracteres.`,
  integer: (label) => `${label} debe ser un número entero.`,
  range: (label, min, max) => `${label} debe estar entre ${min} y ${max}.`,
};

/** Field labels and fixed codes for the room-type form, localizable as a block. */
export interface RoomTypeFieldLabels {
  name: string;
  codeRequired: string;
  codeInvalid: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  bedType: string;
}

const ES_ROOM_TYPE_LABELS: RoomTypeFieldLabels = {
  name: 'El nombre',
  codeRequired: 'El código es obligatorio.',
  codeInvalid: 'El código debe tener 1–24 letras, números, guiones o guiones bajos.',
  description: 'La descripción',
  capacityAdults: 'La capacidad de adultos',
  capacityChildren: 'La capacidad de menores',
  bedType: 'El tipo de cama',
};

function textWithCopy(
  value: string,
  label: string,
  limits: { max?: number },
  copy: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return copy.required(label);
  }
  if (limits.max !== undefined && trimmed.length > limits.max) {
    return copy.maxLength(label, limits.max);
  }
  return null;
}

function optionalTextWithCopy(
  value: string,
  label: string,
  limits: { max?: number },
  copy: ValidationCopy,
): string | null {
  return value.trim() === '' ? null : textWithCopy(value, label, limits, copy);
}

function intWithCopy(
  value: string,
  label: string,
  limits: { min: number; max: number },
  copy: ValidationCopy,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return copy.integer(label);
  }
  const parsed = Number(trimmed);
  if (parsed < limits.min || parsed > limits.max) {
    return copy.range(label, limits.min, limits.max);
  }
  return null;
}

/**
 * Mirrors CreateRoomTypeDto / UpdateRoomTypeDto.
 * Pass `copy` + `labels` from the active dictionary to keep the messages in the
 * screen's language; omitting them yields the historical Spanish messages.
 */
export function validateRoomType(
  input: {
    name: string;
    code: string;
    description: string;
    capacityAdults: string;
    capacityChildren: string;
    bedType: string;
    codeLocked?: boolean;
  },
  options: { codeLocked?: boolean; copy?: ValidationCopy; labels?: RoomTypeFieldLabels } = {},
): FieldErrors {
  const copy = options.copy ?? ES_VALIDATION_COPY;
  const labels = options.labels ?? ES_ROOM_TYPE_LABELS;
  const codeLocked = options.codeLocked ?? input.codeLocked;
  const errors: FieldErrors = {};

  collect(errors, 'name', textWithCopy(input.name, labels.name, { max: 120 }, copy));
  if (codeLocked !== true) {
    const code = input.code.trim();
    collect(
      errors,
      'code',
      code === ''
        ? labels.codeRequired
        : ROOM_TYPE_CODE_PATTERN.test(code)
          ? null
          : labels.codeInvalid,
    );
  }
  collect(
    errors,
    'description',
    optionalTextWithCopy(input.description, labels.description, { max: 500 }, copy),
  );
  collect(
    errors,
    'capacityAdults',
    intWithCopy(input.capacityAdults, labels.capacityAdults, { min: 1, max: 50 }, copy),
  );
  collect(
    errors,
    'capacityChildren',
    intWithCopy(input.capacityChildren, labels.capacityChildren, { min: 0, max: 50 }, copy),
  );
  collect(
    errors,
    'bedType',
    optionalTextWithCopy(input.bedType, labels.bedType, { max: 64 }, copy),
  );
  return errors;
}

export interface RoomFieldLabels {
  numberRequired: string;
  numberInvalid: string;
  roomTypeRequired: string;
  floor: string;
  building: string;
  attributes: AttributeMessages;
}

const ES_ROOM_LABELS: RoomFieldLabels = {
  numberRequired: 'El número es obligatorio.',
  numberInvalid: 'Hasta 32 letras, números, puntos, guiones, guiones bajos o barras.',
  roomTypeRequired: 'Elegí un tipo de habitación.',
  floor: 'El piso',
  building: 'El edificio',
  attributes: ES_ATTRIBUTE_MESSAGES,
};

/** Mirrors CreateRoomDto / UpdateRoomDto. */
export function validateRoom(
  input: {
    number: string;
    roomTypeId: string;
    floor: string;
    building: string;
    attributes: string;
  },
  options: { copy?: ValidationCopy; labels?: RoomFieldLabels } = {},
): FieldErrors {
  const copy = options.copy ?? ES_VALIDATION_COPY;
  const labels = options.labels ?? ES_ROOM_LABELS;
  const errors: FieldErrors = {};
  const number = input.number.trim();
  collect(
    errors,
    'number',
    number === ''
      ? labels.numberRequired
      : ROOM_NUMBER_PATTERN.test(number)
        ? null
        : labels.numberInvalid,
  );
  if (input.roomTypeId.trim() === '') {
    errors.roomTypeId = labels.roomTypeRequired;
  }
  collect(errors, 'floor', optionalText(input.floor, labels.floor, { max: 32 }, copy));
  collect(errors, 'building', optionalText(input.building, labels.building, { max: 64 }, copy));
  collect(errors, 'attributes', attributesField(input.attributes, labels.attributes));
  return errors;
}

function validateDocument(
  documentType: string,
  documentNumber: string,
  copy?: ValidationCopy,
  label = 'El número de documento',
): string | null {
  if (documentType === '') {
    return null;
  }
  return requiredText(documentNumber, label, LIMITS.guestDocument, copy);
}
