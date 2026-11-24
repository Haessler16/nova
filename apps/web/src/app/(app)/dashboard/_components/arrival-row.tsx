'use client';

import { Avatar, Box, Flex, HStack, IconButton, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { StatusBadge } from '@/components/ui';
import { ArrowRightIcon } from '@/components/icons';
import {
  RESERVATION_STATUS_COLORS,
  reservationStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';

export function ArrivalRow({ reservation }: { reservation: Reservation }) {
  const { t, locale } = useI18n();

  return (
    <Flex
      direction={{ base: 'column', sm: 'row' }}
      align={{ base: 'stretch', sm: 'center' }}
      justify="space-between"
      gap={3}
      py={3}
      borderBottomWidth="1px"
      borderColor="line"
      _last={{ borderBottomWidth: 0, pb: 0 }}
    >
      <HStack spacing={3} minW={0}>
        <Avatar
          size="sm"
          name={reservation.guest.fullName}
          bg="sky.50"
          color="sky.700"
          fontWeight="bold"
        />
        <Box minW={0}>
          <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
            {reservation.guest.fullName}
          </Text>
          <Text fontSize="xs" color="textSecondary" noOfLines={1}>
            {reservation.code} · {reservation.roomType.name} ·{' '}
            {reservation.nights === 1
              ? t('dashboard.arrivals.nightsOne', { count: reservation.nights })
              : t('dashboard.arrivals.nightsOther', { count: reservation.nights })}
          </Text>
        </Box>
      </HStack>
      <HStack spacing={3} justify="space-between" flexShrink={0}>
        <Box textAlign={{ base: 'left', sm: 'right' }}>
          <StatusBadge
            color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
            label={reservationStatusLabel(locale, reservation.status)}
          />
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {reservation.room !== null
              ? t('dashboard.arrivals.room', { number: reservation.room.number })
              : t('dashboard.arrivals.noRoom')}
          </Text>
        </Box>
        <IconButton
          as={NextLink}
          href="/front-office?tab=arrivals"
          aria-label={t('dashboard.arrivals.openArrival', {
            name: reservation.guest.fullName,
          })}
          icon={<ArrowRightIcon boxSize={4} />}
          size="sm"
          variant="ghost"
          color="brand.600"
        />
      </HStack>
    </Flex>
  );
}
