'use client';

import { Badge, Box, HStack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { ReservationParty as ReservationPartyResponse } from '@/lib/types';

export function PartyHeader({ party }: { party: ReservationPartyResponse | null }) {
  const { t } = useI18n();

  return (
    <HStack justify="space-between" align="flex-start" mb={3}>
      <Box>
        <Text fontWeight="semibold">{t('party.title')}</Text>
        <Text fontSize="xs" color="gray.500">
          {t('party.subtitle')}
        </Text>
      </Box>
      {party !== null && (
        <Badge
          data-testid="party-readiness"
          colorScheme={
            party.readiness.checkIn === 'BLOCKED'
              ? 'danger'
              : party.readiness.fnrh === 'READY'
                ? 'mint'
                : 'warning'
          }
          textTransform="none"
        >
          {party.readiness.checkIn === 'BLOCKED'
            ? t('party.badge.legal')
            : party.readiness.fnrh === 'READY'
              ? t('party.badge.complete')
              : t('party.badge.incomplete')}
        </Badge>
      )}
    </HStack>
  );
}
