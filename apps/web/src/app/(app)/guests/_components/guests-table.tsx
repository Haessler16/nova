'use client';

import { Table, TableContainer, Tbody, Th, Thead, Tr } from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import { GuestRow } from './guest-row';
import { GuestsSearchBar } from './guests-search-bar';

export function GuestsTable({
  items,
  loading,
  error,
  onRetry,
  searchInput,
  onSearchInputChange,
  onSearch,
  status,
  onStatusChange,
  onClear,
  onOpenNotes,
  onEdit,
  onToggleStatus,
}: {
  items: Guest[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClear: () => void;
  onOpenNotes: (guest: Guest) => void;
  onEdit: (guest: Guest) => void;
  onToggleStatus: (guest: Guest) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <GuestsSearchBar
        searchInput={searchInput}
        onSearchInputChange={onSearchInputChange}
        onSearch={onSearch}
        status={status}
        onStatusChange={onStatusChange}
        onClear={onClear}
        count={items.length}
      />

      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        isEmpty={items.length === 0}
        emptyText={t('guests.empty')}
      >
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('guests.table.guest')}</Th>
                <Th>{t('guests.table.contact')}</Th>
                <Th>{t('guests.table.document')}</Th>
                <Th>{t('guests.table.status')}</Th>
                <Th>{t('guests.table.createdAt')}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {items.map((guest) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  onOpenNotes={onOpenNotes}
                  onEdit={onEdit}
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </QueryFeedback>
    </>
  );
}
