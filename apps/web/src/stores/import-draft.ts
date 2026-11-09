'use client';

import { create } from 'zustand';
import type { GuestImportPreview, GuestImportResult } from '@/lib/guest-import-types';

interface ImportDraftState {
  tenantKey: string | null;
  csv: string;
  preview: GuestImportPreview | null;
  idempotencyKey: string | null;
  result: GuestImportResult | null;
  ensureTenant: (tenantKey: string) => void;
  setCsv: (csv: string) => void;
  setPreview: (preview: GuestImportPreview, idempotencyKey: string) => void;
  complete: (result: GuestImportResult) => void;
  clearPreview: () => void;
  reset: () => void;
}

/**
 * In-memory import draft. CSV content is never written to localStorage or
 * IndexedDB; switching property clears it so one tenant cannot inherit another
 * tenant's preview or idempotency key.
 */
export const useImportDraftStore = create<ImportDraftState>((set, get) => ({
  tenantKey: null,
  csv: '',
  preview: null,
  idempotencyKey: null,
  result: null,

  ensureTenant: (tenantKey) => {
    if (get().tenantKey !== tenantKey) {
      set({
        tenantKey,
        csv: '',
        preview: null,
        idempotencyKey: null,
        result: null,
      });
    }
  },

  setCsv: (csv) =>
    set({
      csv,
      preview: null,
      idempotencyKey: null,
      result: null,
    }),

  setPreview: (preview, idempotencyKey) =>
    set({
      preview,
      idempotencyKey,
      result: null,
    }),

  complete: (result) =>
    set({
      result,
      preview: null,
      idempotencyKey: null,
    }),

  clearPreview: () =>
    set({
      preview: null,
      idempotencyKey: null,
      result: null,
    }),

  reset: () =>
    set({
      csv: '',
      preview: null,
      idempotencyKey: null,
      result: null,
    }),
}));
