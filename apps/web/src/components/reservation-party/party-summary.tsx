'use client';

import { Alert, AlertDescription, AlertIcon, Box, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { ReservationParty as ReservationPartyResponse } from '@/lib/types';
import { adultsLabel, minorsLabel, readinessLabel } from './lib/party-labels';

export function PartySummary({ party }: { party: ReservationPartyResponse }) {
  const { t } = useI18n();
  const legal = party.readiness.checkIn === 'BLOCKED';
  const incomplete = party.readiness.fnrh !== 'READY';

  return (
    <Stack spacing={3}>
      <Text fontSize="sm">
        {adultsLabel(t, party.summary.adults)} · {minorsLabel(t, party.summary.minors)}
        {party.summary.unknown > 0
          ? ` · ${t('party.summary.unknown', { count: party.summary.unknown })}`
          : ''}
        <Text as="span" color="gray.500">
          {' '}
          {t('party.summary.declared', {
            adults: adultsLabel(t, party.summary.declaredAdults),
            children: minorsLabel(t, party.summary.declaredChildren),
          })}
        </Text>
      </Text>

      {legal && (
        <Alert status="error" borderRadius="md" alignItems="flex-start">
          <AlertIcon />
          <AlertDescription fontSize="sm">{t('party.alert.legal')}</AlertDescription>
        </Alert>
      )}
      {!legal && incomplete && (
        <Alert status="warning" borderRadius="md" alignItems="flex-start">
          <AlertIcon />
          <AlertDescription fontSize="sm">{t('party.alert.incomplete')}</AlertDescription>
        </Alert>
      )}
      {!legal && !incomplete && (
        <Alert status="success" borderRadius="md" alignItems="flex-start">
          <AlertIcon />
          <AlertDescription fontSize="sm">{t('party.alert.ready')}</AlertDescription>
        </Alert>
      )}

      {party.readiness.codes.length > 0 && (
        <Box>
          {party.readiness.codes.slice(0, 4).map((code) => (
            <Text key={code} fontSize="xs" color="gray.600">
              • {readinessLabel(t, code)}
            </Text>
          ))}
        </Box>
      )}
    </Stack>
  );
}
