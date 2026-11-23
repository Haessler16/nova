'use client';

import {
  Box,
  Button,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { QueryFeedback, StatusBadge } from '@/components/ui';
import { RESERVATION_STATUS_COLORS, formatCalendarDate, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import type { ReservationSearch } from '../_hooks/use-reservation-search';

function SearchResultRow({
  reservation,
  onCheckIn,
}: {
  reservation: Reservation;
  onCheckIn: (reservation: Reservation) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Tr>
      <Td>
        <Text fontWeight="medium">{reservation.guest.fullName}</Text>
      </Td>
      <Td>{reservation.code}</Td>
      <Td>{reservation.room?.number ?? t('frontOffice.table.noRoom')}</Td>
      <Td>{formatCalendarDate(reservation.checkInDate)}</Td>
      <Td>{formatCalendarDate(reservation.checkOutDate)}</Td>
      <Td>
        <StatusBadge
          color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
          label={reservationStatusLabel(locale, reservation.status)}
        />
      </Td>
      <Td>{reservation.roomType.name}</Td>
      <Td
        position="sticky"
        right={0}
        bg="white"
        zIndex={1}
        borderLeftWidth="1px"
        borderLeftColor="gray.100"
      >
        <HStack spacing={1} justify="flex-end" wrap="wrap">
          <Button
            as={NextLink}
            href={`/reservations?reservation=${reservation.id}`}
            size="xs"
            variant="ghost"
          >
            {t('frontOffice.action.open')}
          </Button>
          <Button
            as={NextLink}
            href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
            size="xs"
            variant="ghost"
          >
            {t('frontOffice.table.guest')}
          </Button>
          {reservation.status === 'CONFIRMED' && (
            <Button size="xs" colorScheme="brand" onClick={() => onCheckIn(reservation)}>
              {t('frontOffice.action.checkIn')}
            </Button>
          )}
        </HStack>
      </Td>
    </Tr>
  );
}

export function SearchResults({
  search,
  onCheckIn,
}: {
  search: ReservationSearch;
  onCheckIn: (reservation: Reservation) => void;
}) {
  const { t } = useI18n();
  if (!search.active) {
    return null;
  }
  return (
    <Box mt={4}>
      <QueryFeedback
        loading={search.loading && search.results.length === 0}
        error={search.error}
        onRetry={search.retry}
        isEmpty={!search.loading && search.results.length === 0}
        emptyText={t('frontOffice.search.empty')}
      >
        <TableContainer overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('frontOffice.table.guest')}</Th>
                <Th>{t('frontOffice.table.reservation')}</Th>
                <Th>{t('frontOffice.table.room')}</Th>
                <Th>{t('frontOffice.table.arrival')}</Th>
                <Th>{t('frontOffice.table.departure')}</Th>
                <Th>{t('frontOffice.table.status')}</Th>
                <Th>{t('frontOffice.table.type')}</Th>
                <Th position="sticky" right={0} bg="white" zIndex={1}>
                  {t('frontOffice.table.actions')}
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {search.results.map((reservation) => (
                <SearchResultRow
                  key={reservation.id}
                  reservation={reservation}
                  onCheckIn={onCheckIn}
                />
              ))}
            </Tbody>
          </Table>
        </TableContainer>
        {search.nextCursor !== null && (
          <HStack justify="center" mt={3}>
            <Button
              size="sm"
              variant="outline"
              isLoading={search.loading}
              onClick={search.loadMore}
            >
              {t('frontOffice.action.loadMore')}
            </Button>
          </HStack>
        )}
      </QueryFeedback>
    </Box>
  );
}
