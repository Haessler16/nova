'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import type { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

export type Tenant = ReturnType<typeof useSession>['tenant'];

interface ListData {
  items: Reservation[];
  nextCursor: string | null;
}

export interface ReservationFilters {
  search: string;
  status: string;
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTERS: ReservationFilters = { search: '', status: '', fromDate: '', toDate: '' };

export function useReservationList(tenant: Tenant, propertyTimezone: string | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ReservationFilters>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsyncData<ListData>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.fromDate !== '') params.set('fromDate', filters.fromDate);
      if (filters.toDate !== '') params.set('toDate', filters.toDate);
      return api<ListData>(`/api/v1/reservations?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:reservations:${JSON.stringify(filters)}`,
  );

  function submitSearch(): void {
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
  }

  function clearFilters(): void {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
  }

  async function exportReservations(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.fromDate !== '') params.set('fromDate', filters.fromDate);
      if (filters.toDate !== '') params.set('toDate', filters.toDate);
      await downloadCsv(
        `/api/v1/exports/reservations?${params.toString()}`,
        tenant,
        `reservas-${todayISO(0, propertyTimezone)}.csv`,
      );
      toast({ title: t('reservations.toast.exported'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('reservations.toast.exportError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(false);
    }
  }

  return {
    searchInput,
    setSearchInput,
    filters,
    setFilters,
    submitSearch,
    clearFilters,
    exportReservations,
    exporting,
    data,
    loading,
    error,
    reload,
  };
}

export type ReservationListController = ReturnType<typeof useReservationList>;
