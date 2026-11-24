'use client';

import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { SectionCard, StatusBadge } from '@/components/ui';
import { RESERVATION_STATUS_COLORS, formatCalendarDate, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';

export function CalendarUnassigned({ reservations }: { reservations: Reservation[] }) {
  const { t, locale } = useI18n();

  if (reservations.length === 0) {
    return null;
  }

  return (
    <Box mt={6}>
      <SectionCard>
        <Text fontWeight="semibold" mb={1}>
          {t('calendar.unassigned.title')}
        </Text>
        <Text fontSize="xs" color="gray.500" mb={3}>
          {t('calendar.unassigned.hint')}
        </Text>
        <Stack spacing={2}>
          {reservations.map((reservation) => (
            <HStack
              key={reservation.id}
              justify="space-between"
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
              wrap="wrap"
            >
              <Box>
                <HStack spacing={2}>
                  <Text fontSize="sm" fontWeight="medium">
                    {reservation.guest.fullName}
                  </Text>
                  <StatusBadge
                    color={RESERVATION_STATUS_COLORS[reservation.status]}
                    label={reservationStatusLabel(locale, reservation.status)}
                  />
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {reservation.code} · {formatCalendarDate(reservation.checkInDate)} →{' '}
                  {formatCalendarDate(reservation.checkOutDate)} · {reservation.roomType.name}
                </Text>
              </Box>
              <Button as={NextLink} href="/reservations" size="xs" variant="outline">
                {t('calendar.unassigned.assign')}
              </Button>
            </HStack>
          ))}
        </Stack>
      </SectionCard>
    </Box>
  );
}
