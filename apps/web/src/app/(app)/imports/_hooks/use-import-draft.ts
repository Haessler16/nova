'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { GuestImportPreview, GuestImportResult } from '@/lib/guest-import-types';
import { useImportDraftStore } from '@/stores/import-draft';
import { useOnlineStatus } from './use-online-status';

export function useImportDraft() {
  const { tenant } = useSession();
  const { t } = useI18n();
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
      toast({ title: t('imports.toast.fileTooLarge'), status: 'error' });
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
        title: t('imports.toast.previewError'),
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
        title: data.replayed ? t('imports.toast.replayed') : t('imports.toast.completed'),
        description: t('imports.toast.created', { count: data.createdCount }),
        status: 'success',
      });
    } catch (cause) {
      toast({
        title: t('imports.toast.error'),
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
