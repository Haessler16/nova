'use client';

import { SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { formatCalendarDate, housekeepingLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CheckInRoomOption, Reservation, ReservationParty } from '@/lib/types';
import { SummaryRow } from './summary-row';

export function StepConfirm({
  reservation,
  selectedRoom,
  party,
  partyBlocked,
  unreadInstructions,
}: {
  reservation: Reservation;
  selectedRoom: CheckInRoomOption | null;
  party: ReservationParty | null;
  partyBlocked: boolean;
  unreadInstructions: number;
}) {
  const { t, locale } = useI18n();

  return (
    <Stack spacing={3}>
      <Text fontSize="sm" color="gray.600">
        {t('checkIn.review.help')}
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
        <SummaryRow label={t('checkIn.summary.guest')} value={reservation.guest.fullName} />
        <SummaryRow label={t('checkIn.summary.reservation')} value={reservation.code} />
        <SummaryRow
          label={t('checkIn.review.stay')}
          value={`${formatCalendarDate(reservation.checkInDate)} → ${formatCalendarDate(
            reservation.checkOutDate,
          )}`}
        />
        <SummaryRow
          label={t('checkIn.review.room')}
          value={
            selectedRoom === null
              ? t('checkIn.review.noRoom')
              : t('frontOffice.rack.room', { number: selectedRoom.number })
          }
        />
        <SummaryRow
          label={t('checkIn.review.housekeeping')}
          value={
            selectedRoom === null ? '—' : housekeepingLabel(locale, selectedRoom.housekeepingState)
          }
        />
        <SummaryRow
          label={t('checkIn.review.partyDocs')}
          value={party?.readiness.checkIn ?? t('checkIn.review.partyDocsNone')}
        />
        <SummaryRow label={t('checkIn.review.unread')} value={String(unreadInstructions)} />
      </SimpleGrid>
      {partyBlocked && (
        <Text fontSize="sm" color="danger.600">
          {t('checkIn.review.blocked')}
        </Text>
      )}
    </Stack>
  );
}
