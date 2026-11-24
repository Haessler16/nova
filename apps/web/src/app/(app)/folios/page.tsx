'use client';

import { Button, HStack, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DownloadIcon } from '@/components/icons';
import { PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio, Reservation } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { FolioCreateModal } from './_components/folio-create-modal';
import { FoliosFilterBar, type FoliosFilters } from './_components/folios-filter-bar';
import { FoliosTable } from './_components/folios-table';

function FoliosContent() {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const propertyTimezone = property?.timezone;
  const toast = useToast();
  const modal = useDisclosure();

  const [filters, setFilters] = useState<FoliosFilters>({ status: '', search: '' });
  const [exporting, setExporting] = useState(false);

  const folios = useAsyncData<{ items: Folio[] }>(
    () => {
      const params = new URLSearchParams();
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      return api<{ items: Folio[] }>(`/api/v1/folios?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:folios:${JSON.stringify(filters)}`,
  );

  const reservations = useAsyncData<{ items: Reservation[] }>(
    () => api<{ items: Reservation[] }>('/api/v1/reservations?limit=100', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:folios:reservations`,
  );

  async function exportFolios(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      await downloadCsv(
        `/api/v1/exports/folios?${params.toString()}`,
        tenant,
        `folios-${todayISO(0, propertyTimezone)}.csv`,
      );
      toast({ title: t('folios.toast.exported'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('folios.toast.exportError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('folios.eyebrow')}
        title={t('folios.title')}
        description={t('folios.description')}
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportFolios()}
              isLoading={exporting}
            >
              {t('folios.export')}
            </Button>
            <Button colorScheme="brand" onClick={modal.onOpen}>
              {t('folios.open')}
            </Button>
          </HStack>
        }
      />

      <FoliosFilterBar filters={filters} onChange={setFilters} />

      <SectionCard>
        <FoliosTable
          items={folios.data?.items ?? []}
          reservations={reservations.data?.items ?? []}
          loading={folios.loading}
          error={folios.error}
          onRetry={folios.reload}
        />
      </SectionCard>

      <FolioCreateModal
        isOpen={modal.isOpen}
        onClose={modal.onClose}
        reservations={reservations.data?.items ?? []}
        reservationsError={reservations.error}
      />
    </>
  );
}

export default function FoliosPage() {
  return (
    <PropertyGate>
      <FoliosContent />
    </PropertyGate>
  );
}
