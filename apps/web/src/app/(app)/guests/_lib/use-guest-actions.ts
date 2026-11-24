'use client';

import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';

export function useGuestActions({
  filters,
  reload,
}: {
  filters: { search: string; status: string };
  reload: () => void;
}) {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  async function toggleStatus(guest: Guest): Promise<void> {
    const next = guest.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api<Guest>(`/api/v1/guests/${guest.id}`, {
        method: 'PATCH',
        tenant,
        body: { status: next },
      });
      toast({
        title: next === 'ACTIVE' ? t('guests.toast.reactivated') : t('guests.toast.disabled'),
        status: 'success',
      });
      reload();
    } catch (cause) {
      toast({
        title: t('guests.toast.statusError'),
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  async function exportGuests(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      await downloadCsv(
        `/api/v1/exports/guests?${params.toString()}`,
        tenant,
        `huespedes-${todayISO(0, property?.timezone)}.csv`,
      );
      toast({ title: t('guests.toast.exported'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('guests.toast.exportError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(false);
    }
  }

  return { toggleStatus, exportGuests, exporting };
}
