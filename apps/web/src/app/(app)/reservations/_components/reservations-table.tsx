'use client';

import { HStack, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import {
  RowActionButton,
  RowActionLink,
  StatusBadge,
} from '@/components/ui';
import {
  RESERVATION_STATUS_COLORS,
  formatCalendarDate,
  reservationStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { adultsLabel, childrenLabel, nightsLabel } from '../_lib/reservation-labels';

function ReservationRow({
  reservation,
  onOpenDetail,
  onEdit,
  onCancel,
}: {
  reservation: Reservation;
  onOpenDetail: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Tr>
      <Td>
        <Text as="code" fontSize="xs" fontWeight="semibold">
          {reservation.code}
        </Text>
        <Text fontSize="xs" color="textSecondary">
          {reservation.source ?? t('reservations.row.direct')}
        </Text>
      </Td>
      <Td>
        <Text fontWeight="medium">{reservation.guest.fullName}</Text>
        <Text fontSize="xs" color="textSecondary">
          {reservation.guest.email ?? reservation.guest.phone ?? t('reservations.row.noContact')}
        </Text>
      </Td>
      <Td>
        <Text fontSize="sm">
          {formatCalendarDate(reservation.checkInDate)} →{' '}
          {formatCalendarDate(reservation.checkOutDate)}
        </Text>
        <Text fontSize="xs" color="textSecondary">
          {nightsLabel(t, reservation.nights)} · {adultsLabel(t, reservation.adults)}
          {reservation.children > 0 ? ` · ${childrenLabel(t, reservation.children)}` : ''}
        </Text>
      </Td>
      <Td>
        <Text fontSize="sm">{reservation.roomType.name}</Text>
        <Text fontSize="xs" color="textSecondary">
          {reservation.room !== null
            ? t('reservations.roomPrefix', { number: reservation.room.number })
            : t('reservations.unassigned')}
        </Text>
      </Td>
      <Td>
        <StatusBadge
          color={RESERVATION_STATUS_COLORS[reservation.status]}
          label={reservationStatusLabel(locale, reservation.status)}
        />
      </Td>
      <Td>
        <HStack spacing={1} justify="flex-end" wrap="nowrap">
          <RowActionLink
            href={`/reservations?reservation=${reservation.id}`}
            label={t('reservations.row.open', { code: reservation.code })}
            onClick={() => onOpenDetail(reservation)}
          >
            {t('reservations.row.detail')}
          </RowActionLink>
          {reservation.status === 'CONFIRMED' && (
            <>
              <RowActionButton onClick={() => onEdit(reservation)}>
                {t('reservations.row.edit')}
              </RowActionButton>
              <RowActionButton onClick={() => onCancel(reservation)} colorScheme="danger">
                {t('reservations.row.cancel')}
              </RowActionButton>
            </>
          )}
        </HStack>
      </Td>
    </Tr>
  );
}

export function ReservationsTable({
  rows,
  onOpenDetail,
  onEdit,
  onCancel,
}: {
  rows: Reservation[];
  onOpenDetail: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}) {
  const { t } = useI18n();
  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>{t('reservations.column.code')}</Th>
            <Th>{t('reservations.column.guest')}</Th>
            <Th>{t('reservations.column.stay')}</Th>
            <Th>{t('reservations.column.room')}</Th>
            <Th>{t('reservations.column.status')}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              onOpenDetail={onOpenDetail}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
