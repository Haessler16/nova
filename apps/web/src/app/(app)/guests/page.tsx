'use client';

import { Button, HStack, useDisclosure } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DownloadIcon } from '@/components/icons';
import { PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { GuestFormModal } from './_components/guest-form-modal';
import { GuestNotesModal } from './_components/guest-notes-modal';
import { GuestsTable } from './_components/guests-table';
import { useGuestActions } from './_lib/use-guest-actions';

function GuestsContent() {
  const { tenant } = useSession();
  const { t } = useI18n();
  const modal = useDisclosure();
  const notesModal = useDisclosure();
  const [notesTarget, setNotesTarget] = useState<Guest | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '' });

  const appliedQuery = useRef(false);
  useEffect(() => {
    if (appliedQuery.current) {
      return;
    }
    appliedQuery.current = true;
    // Deep link from Front Desk search results.
    const search = new URLSearchParams(window.location.search).get('search');
    if (search !== null && search.trim() !== '') {
      setSearchInput(search.trim());
      setFilters({ search: search.trim(), status: '' });
    }
  }, []);

  const { data, loading, error, reload } = useAsyncData<{ items: Guest[] }>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:guests:${JSON.stringify(filters)}`,
  );

  const { toggleStatus, exportGuests, exporting } = useGuestActions({ filters, reload });

  return (
    <>
      <PageHeader
        title={t('guests.title')}
        description={t('guests.description')}
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportGuests()}
              isLoading={exporting}
            >
              {t('guests.export')}
            </Button>
            <Button
              colorScheme="brand"
              size="sm"
              onClick={() => {
                setEditing(null);
                modal.onOpen();
              }}
            >
              {t('guests.create')}
            </Button>
          </HStack>
        }
      />

      <SectionCard>
        <GuestsTable
          items={data?.items ?? []}
          loading={loading}
          error={error}
          onRetry={reload}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={() => setFilters((current) => ({ ...current, search: searchInput.trim() }))}
          status={filters.status}
          onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
          onClear={() => {
            setSearchInput('');
            setFilters({ search: '', status: '' });
          }}
          onOpenNotes={(guest) => {
            setNotesTarget(guest);
            notesModal.onOpen();
          }}
          onEdit={(guest) => {
            setEditing(guest);
            modal.onOpen();
          }}
          onToggleStatus={(guest) => void toggleStatus(guest)}
        />
      </SectionCard>

      <GuestNotesModal
        guest={notesTarget}
        isOpen={notesModal.isOpen}
        onClose={notesModal.onClose}
      />

      <GuestFormModal
        isOpen={modal.isOpen}
        onClose={modal.onClose}
        guest={editing}
        onSaved={reload}
      />
    </>
  );
}

export default function GuestsPage() {
  return (
    <PropertyGate>
      <GuestsContent />
    </PropertyGate>
  );
}
