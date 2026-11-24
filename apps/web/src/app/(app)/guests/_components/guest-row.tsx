'use client';

import { HStack, Td, Text, Tr } from '@chakra-ui/react';
import { GuestDocuments } from '@/components/guest-documents';
import { RowActionButton, StatusBadge } from '@/components/ui';
import {
  RECORD_STATUS_COLORS,
  documentTypeLabel,
  formatDateTime,
  recordStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';

export function GuestRow({
  guest,
  onOpenNotes,
  onEdit,
  onToggleStatus,
}: {
  guest: Guest;
  onOpenNotes: (guest: Guest) => void;
  onEdit: (guest: Guest) => void;
  onToggleStatus: (guest: Guest) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Tr>
      <Td>
        <Text fontWeight="medium">{guest.fullName}</Text>
        {guest.notes !== null && (
          <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="260px">
            {guest.notes}
          </Text>
        )}
      </Td>
      <Td>
        <Text fontSize="sm">{guest.email ?? '—'}</Text>
        <Text fontSize="xs" color="textSecondary">
          {guest.phone ?? t('guests.noPhone')}
        </Text>
      </Td>
      <Td>
        {guest.documentType !== null && guest.documentNumber !== null ? (
          <>
            <Text fontSize="sm">{documentTypeLabel(locale, guest.documentType)}</Text>
            <Text as="code" fontSize="xs">
              {guest.documentNumber}
            </Text>
          </>
        ) : (
          <Text fontSize="sm" color="textSecondary">
            {t('guests.noDocument')}
          </Text>
        )}
      </Td>
      <Td>
        <StatusBadge
          color={RECORD_STATUS_COLORS[guest.status] ?? 'gray'}
          label={recordStatusLabel(locale, guest.status)}
        />
      </Td>
      <Td>
        <Text fontSize="xs" color="textSecondary">
          {formatDateTime(guest.createdAt)}
        </Text>
      </Td>
      <Td>
        <HStack spacing={1} justify="flex-end" wrap="nowrap">
          <GuestDocuments guestId={guest.id} guestName={guest.fullName} />
          <RowActionButton onClick={() => onOpenNotes(guest)}>{t('guests.notes')}</RowActionButton>
          <RowActionButton onClick={() => onEdit(guest)}>{t('guests.edit')}</RowActionButton>
          <RowActionButton
            onClick={() => onToggleStatus(guest)}
            colorScheme={guest.status === 'ACTIVE' ? 'warning' : 'sky'}
          >
            {guest.status === 'ACTIVE' ? t('guests.disable') : t('guests.reactivate')}
          </RowActionButton>
        </HStack>
      </Td>
    </Tr>
  );
}
