import type { GuestDocumentType } from './types';

export interface GuestImportValues {
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  notes: string | null;
}

export interface GuestImportRow {
  line: number;
  values: GuestImportValues;
  errors: string[];
}

export interface GuestImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: GuestImportRow[];
}

export interface GuestImportResult {
  importId: string;
  rowCount: number;
  createdCount: number;
  replayed: boolean;
}
