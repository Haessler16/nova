import {
  buildErrors,
  calendarDateField,
  dateRangeField,
  intField,
  optionalText,
  reasonField,
  reservationCodeField,
  type FieldErrors,
} from '@/lib/validation';
import type { CreateForm, EditForm } from './reservation-forms';
import type { Translator } from './reservation-labels';
import { validationCopy } from './reservation-labels';

export function validateCreateForm(form: CreateForm, t: Translator): FieldErrors {
  const copy = validationCopy(t);
  return buildErrors([
    ['checkInDate', calendarDateField(form.checkInDate, t('validation.label.checkIn'), copy)],
    ['checkOutDate', calendarDateField(form.checkOutDate, t('validation.label.checkOut'), copy)],
    ['dates', dateRangeField(form.checkInDate, form.checkOutDate, { copy })],
    ['adults', intField(form.adults, t('validation.label.adults'), { min: 1, max: 20 }, copy)],
    [
      'children',
      intField(form.children, t('validation.label.children'), { min: 0, max: 20 }, copy),
    ],
    ['guestId', form.guestId === '' ? t('validation.guestRequired') : null],
    ['roomTypeId', form.roomTypeId === '' ? t('validation.roomTypeRequired') : null],
    ['code', reservationCodeField(form.code, copy)],
    ['source', optionalText(form.source, t('validation.label.source'), { max: 32 }, copy)],
    ['notes', optionalText(form.notes, t('validation.label.observation'), { max: 2000 }, copy)],
  ]);
}

export function createBody(form: CreateForm): Record<string, unknown> {
  return {
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    adults: Number(form.adults),
    children: Number(form.children),
    guestId: form.guestId,
    roomTypeId: form.roomTypeId,
    ...(form.roomId !== '' ? { roomId: form.roomId } : {}),
    ...(form.code.trim() !== '' ? { code: form.code.trim().toUpperCase() } : {}),
    ...(form.source.trim() !== '' ? { source: form.source.trim() } : {}),
    ...(form.notes.trim() !== '' ? { notes: form.notes.trim() } : {}),
    idempotencyKey: form.idempotencyKey,
  };
}

export function validateEditForm(form: EditForm, t: Translator): FieldErrors {
  const copy = validationCopy(t);
  return buildErrors([
    ['checkInDate', calendarDateField(form.checkInDate, t('validation.label.checkIn'), copy)],
    ['checkOutDate', calendarDateField(form.checkOutDate, t('validation.label.checkOut'), copy)],
    ['dates', dateRangeField(form.checkInDate, form.checkOutDate, { copy })],
    ['adults', intField(form.adults, t('validation.label.adults'), { min: 1, max: 20 }, copy)],
    [
      'children',
      intField(form.children, t('validation.label.children'), { min: 0, max: 20 }, copy),
    ],
    ['notes', optionalText(form.notes, t('validation.label.notes'), { max: 2000 }, copy)],
  ]);
}

export function editBody(form: EditForm): Record<string, unknown> {
  return {
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    adults: Number(form.adults),
    children: Number(form.children),
    notes: form.notes.trim(),
  };
}

export function validateCancelReason(reason: string, t: Translator): FieldErrors {
  const copy = validationCopy(t);
  return buildErrors([
    [
      'reason',
      reason === '' ? null : reasonField(reason, t('validation.label.cancelReason'), {}, copy),
    ],
  ]);
}
