'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { GuestImportPreview, GuestImportResult } from '@/lib/guest-import-types';
import { useImportDraftStore } from '@/stores/import-draft';
import { useOnlineStatus } from './use-online-status';

export function useImportDraft() {
  const { tenant } = useSession();
  const toast = useToast();
  const tenantKey = `${tenant.organizationId}:${tenant.propertyId}`;
  const draftTenantKey = useImportDraftStore((state) => state.tenantKey);
  const storedCsv = useImportDraftStore((state) => state.csv);
  const storedPreview = useImportDraftStore((state) => state.preview);
  const storedIdempotencyKey = useImportDraftStore((state) => state.idempotencyKey);
  const storedResult = useImportDraftStore((state) => state.result);

  // Hide the previous property's draft until ensureTenant resets it.
  const tenantMatches = draftTenantKey === tenantKey;
  const csv = tenantMatches ? storedCsv : '';
  const preview = tenantMatches ? storedPreview : null;
  const idempotencyKey = tenantMatches ? storedIdempotencyKey : null;
  const result = tenantMatches ? storedResult : null;
  const ensureTenant = useImportDraftStore((state) => state.ensureTenant);
  const setCsv = useImportDraftStore((state) => state.setCsv);
  const setPreview = useImportDraftStore((state) => state.setPreview);
  const complete = useImportDraftStore((state) => state.complete);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    ensureTenant(tenantKey);
  }, [ensureTenant, tenantKey]);

  async function loadFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    if (file.size > 512 * 1024) {
      toast({ title: 'El archivo supera 512 KB', status: 'error' });
      return;
    }
    setCsv(await file.text());
  }

  async function runPreview(): Promise<void> {
    setBusy('preview');
    try {
      const data = await api<GuestImportPreview>('/api/v1/guests/import/preview', {
        method: 'POST',
        tenant,
        body: { csv },
      });
      setPreview(data, crypto.randomUUID());
    } catch (cause) {
      toast({
        title: 'No se pudo leer el CSV',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  async function runCommit(): Promise<void> {
    if (preview === null || idempotencyKey === null || preview.invalidRows > 0) {
      return;
    }
    setBusy('commit');
    try {
      const data = await api<GuestImportResult>('/api/v1/guests/import', {
        method: 'POST',
        tenant,
        body: { csv, idempotencyKey },
      });
      complete(data);
      toast({
        title: data.replayed ? 'Importación ya confirmada' : 'Importación completada',
        description: `${data.createdCount} huéspedes creados.`,
        status: 'success',
      });
    } catch (cause) {
      toast({
        title: 'No se pudo importar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  const canPreview = csv.trim() !== '' && online && busy === null;
  const canCommit =
    preview !== null &&
    preview.invalidRows === 0 &&
    preview.totalRows > 0 &&
    online &&
    busy === null;

  return {
    tenantKey,
    csv,
    preview,
    result,
    busy,
    online,
    canPreview,
    canCommit,
    setCsv,
    loadFile,
    runPreview,
    runCommit,
  };
}

export type ImportDraft = ReturnType<typeof useImportDraft>;
