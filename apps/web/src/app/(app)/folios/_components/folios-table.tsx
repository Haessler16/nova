'use client';

import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { QueryFeedback, RowActionLink, StatusBadge } from '@/components/ui';
import {
  FOLIO_STATUS_COLORS,
  folioStatusLabel,
  formatDateTime,
  formatMoney,
  reservationStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio, Reservation } from '@/lib/types';

export function FoliosTable({
  items,
  reservations,
  loading,
  error,
  onRetry,
}: {
  items: Folio[];
  reservations: Reservation[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <QueryFeedback
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyText={t('folios.empty')}
    >
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>{t('folios.table.folio')}</Th>
              <Th>{t('folios.table.reservation')}</Th>
              <Th isNumeric>{t('folios.table.charges')}</Th>
              <Th isNumeric>{t('folios.table.payments')}</Th>
              <Th isNumeric>{t('folios.table.balance')}</Th>
              <Th>{t('folios.table.status')}</Th>
              <Th>{t('folios.table.createdAt')}</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {items.map((folio) => {
              const reservation = reservations.find((item) => item.id === folio.reservationId);
              return (
                <Tr key={folio.id}>
                  <Td fontWeight="semibold">{folio.number}</Td>
                  <Td>
                    <Text fontSize="sm">
                      {reservation?.code ?? folio.reservationId?.slice(0, 8) ?? '—'}
                    </Text>
                    {reservation !== undefined && (
                      <Text fontSize="xs" color="textSecondary">
                        {reservation.guest.fullName} ·{' '}
                        {reservationStatusLabel(locale, reservation.status)}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>{formatMoney(folio.totals.charges, folio.currencyCode)}</Td>
                  <Td isNumeric>{formatMoney(folio.totals.payments, folio.currencyCode)}</Td>
                  <Td isNumeric fontWeight="semibold">
                    {formatMoney(folio.totals.balance, folio.currencyCode)}
                  </Td>
                  <Td>
                    <StatusBadge
                      color={FOLIO_STATUS_COLORS[folio.status]}
                      label={folioStatusLabel(locale, folio.status)}
                    />
                  </Td>
                  <Td>{formatDateTime(folio.createdAt)}</Td>
                  <Td isNumeric>
                    <RowActionLink
                      href={`/folios/${folio.id}`}
                      label={t('folios.openLabel', { number: folio.number })}
                    >
                      {t('folios.openAction')}
                    </RowActionLink>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </QueryFeedback>
  );
}
