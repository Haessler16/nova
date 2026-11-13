export const DOCUMENT_TYPES = ['GUEST_REGISTRATION', 'LODGING_TERMS', 'CHECKIN_SUMMARY'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LOCALES = ['pt-BR'] as const;
export type DocumentLocale = (typeof DOCUMENT_LOCALES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  GUEST_REGISTRATION: 'Ficha de registro de hóspede',
  LODGING_TERMS: 'Termos e condições de hospedagem',
  CHECKIN_SUMMARY: 'Resumo de check-in',
};

export interface DocumentTemplateContext {
  id: string;
  key: DocumentType;
  version: number;
  title: string;
  /** Plain text only. The renderer escapes this value. */
  body: string;
}

export interface DocumentContext {
  schemaVersion: 1;
  document: {
    number: string | null;
    type: DocumentType;
    typeLabel: string;
    title: string;
    locale: DocumentLocale;
    templateVersion: number;
    generatedAt: string;
  };
  template: DocumentTemplateContext;
  property: {
    id: string;
    name: string;
    code: string;
    timezone: string;
    currencyCode: string;
  };
  guest: {
    fullName: string;
    documentType: string | null;
    documentNumberMasked: string | null;
    email: string | null;
    phone: string | null;
  };
  reservation: {
    id: string;
    code: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    roomType: string;
    roomNumber: string | null;
  };
  stay: {
    id: string;
    status: string;
    checkedInAt: string;
    checkedOutAt: string | null;
  } | null;
  signatureRequired: boolean;
}

export function signatureRequired(type: DocumentType): boolean {
  return type !== 'CHECKIN_SUMMARY';
}
