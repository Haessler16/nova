'use client';

import { Box, Button, HStack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { ReservationDocuments } from '@/components/documents-panel';
import { StatusBadge } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import type { Stay } from '@/lib/types';

export function StayCard({
  stay,
  busy,
  readOnly = false,
  onCheckOut,
  onMove,
  onIncident,
}: {
  stay: Stay;
  busy: string | null;
  readOnly?: boolean;
  onCheckOut: (stay: Stay) => void;
  onMove: (stay: Stay) => void;
  onIncident: (stay: Stay) => void;
}) {
  const { t } = useI18n();
  return (
    <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            {t('frontOffice.stay.card', {
              number: stay.room.number,
              name: stay.guest.fullName,
            })}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {stay.reservation.code} ·{' '}
            {t('frontOffice.stay.checkout', {
              date: formatCalendarDate(stay.reservation.checkOutDate),
            })}
            {stay.moveCount > 0
              ? ` · ${t('frontOffice.stay.moves', { count: stay.moveCount })}`
              : ''}
            {stay.checkedOutAt !== null
              ? ` · ${t('frontOffice.stay.checkedOut', { time: formatDateTime(stay.checkedOutAt) })}`
              : ''}
          </Text>
        </Box>
        <StatusBadge
          color={stay.status === 'CHECKED_OUT' ? 'sky' : 'mint'}
          label={t(
            stay.status === 'CHECKED_OUT'
              ? 'frontOffice.stay.statusOut'
              : 'frontOffice.stay.statusIn',
          )}
        />
      </HStack>
      <HStack spacing={1} mt={2} wrap="wrap">
        {!readOnly && (
          <>
            <Button
              size="xs"
              colorScheme="brand"
              onClick={() => onCheckOut(stay)}
              isLoading={busy === `check-out:${stay.id}`}
            >
              {t('frontOffice.action.checkOut')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => onMove(stay)}>
              {t('frontOffice.action.move')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onIncident(stay)}>
              {t('frontOffice.action.incident')}
            </Button>
          </>
        )}
        <ReservationDocuments
          reservationId={stay.reservation.id}
          reservationCode={stay.reservation.code}
        />
        <Button as={NextLink} href="/reservations" size="xs" variant="ghost">
          {t('frontOffice.action.reservation')}
        </Button>
      </HStack>
    </Box>
  );
}
