import type { Guest, GuestDocumentType } from '@/lib/types';

export interface GuestForm {
  fullName: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
  notes: string;
}

export const EMPTY_FORM: GuestForm = {
  fullName: '',
  email: '',
  phone: '',
  documentType: '',
  documentNumber: '',
  notes: '',
};

export function formFromGuest(guest: Guest): GuestForm {
  return {
    fullName: guest.fullName,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    documentType: guest.documentType ?? '',
    documentNumber: guest.documentNumber ?? '',
    notes: guest.notes ?? '',
  };
}
