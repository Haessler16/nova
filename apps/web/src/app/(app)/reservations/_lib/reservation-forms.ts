import type { Guest, GuestDocumentType } from '@/lib/types';
import { todayISO } from '@/lib/format';

export interface GuestFormState {
  fullName: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
}

export const EMPTY_GUEST_FORM: GuestFormState = {
  fullName: '',
  email: '',
  phone: '',
  documentType: '',
  documentNumber: '',
};

export function guestFormFrom(guest: Guest): GuestFormState {
  return {
    fullName: guest.fullName,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    documentType: guest.documentType ?? '',
    documentNumber: guest.documentNumber ?? '',
  };
}

export function guestCreateBody(form: GuestFormState): Record<string, unknown> {
  return {
    fullName: form.fullName.trim(),
    ...(form.email.trim() !== '' ? { email: form.email.trim() } : {}),
    ...(form.phone.trim() !== '' ? { phone: form.phone.trim() } : {}),
    ...(form.documentType !== ''
      ? { documentType: form.documentType, documentNumber: form.documentNumber.trim() }
      : {}),
  };
}

export function guestUpdateBody(form: GuestFormState): Record<string, unknown> {
  return {
    fullName: form.fullName.trim(),
    ...(form.email.trim() !== '' ? { email: form.email.trim() } : {}),
    ...(form.phone.trim() !== '' ? { phone: form.phone.trim() } : {}),
    ...(form.documentType === ''
      ? { documentType: null, documentNumber: null }
      : { documentType: form.documentType, documentNumber: form.documentNumber.trim() }),
  };
}

export interface CreateForm {
  checkInDate: string;
  checkOutDate: string;
  adults: string;
  children: string;
  guestId: string;
  roomTypeId: string;
  roomId: string;
  code: string;
  source: string;
  notes: string;
  idempotencyKey: string;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initialCreateForm(propertyTimezone: string | undefined): CreateForm {
  return {
    checkInDate: todayISO(0, propertyTimezone),
    checkOutDate: todayISO(1, propertyTimezone),
    adults: '2',
    children: '0',
    guestId: '',
    roomTypeId: '',
    roomId: '',
    code: '',
    source: '',
    notes: '',
    idempotencyKey: newIdempotencyKey(),
  };
}

export interface EditForm {
  checkInDate: string;
  checkOutDate: string;
  adults: string;
  children: string;
  notes: string;
}
