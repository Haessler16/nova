'use client';

import { Button, useDisclosure } from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { RoomType } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { RoomTypeModal } from './_components/room-type-modal';
import { RoomTypesTable } from './_components/room-types-table';

function RoomTypesContent() {
  const { tenant } = useSession();
  const { t } = useI18n();
  const modal = useDisclosure();
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<RoomType | null>(null);

  const { data, loading, error, reload } = useAsyncData<{ items: RoomType[] }>(
    () =>
      api<{ items: RoomType[] }>(
        `/api/v1/inventory/room-types${statusFilter !== '' ? `?status=${statusFilter}` : ''}`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:room-types:${statusFilter}`,
  );

  function openCreate(): void {
    setEditing(null);
    modal.onOpen();
  }

  function openEdit(roomType: RoomType): void {
    setEditing(roomType);
    modal.onOpen();
  }

  return (
    <>
      <PageHeader
        title={t('roomTypes.title')}
        description={t('roomTypes.description')}
        actions={
          <Button colorScheme="brand" size="sm" onClick={openCreate}>
            {t('roomTypes.new')}
          </Button>
        }
      />

      <SectionCard>
        <RoomTypesTable
          items={data?.items ?? []}
          loading={loading}
          error={error}
          onRetry={reload}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onEdit={openEdit}
        />
      </SectionCard>

      <RoomTypeModal
        isOpen={modal.isOpen}
        onClose={modal.onClose}
        roomType={editing}
        onSaved={reload}
      />
    </>
  );
}

export default function RoomTypesPage() {
  return (
    <PropertyGate>
      <RoomTypesContent />
    </PropertyGate>
  );
}
