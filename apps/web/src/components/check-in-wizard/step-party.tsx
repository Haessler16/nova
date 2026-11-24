'use client';

import { Badge, Box, Button, HStack, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { QueryFeedback } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Reservation, ReservationParty, ReservationPartyMember } from '@/lib/types';
import { documentLabel } from './lib/check-in-labels';

export function StepParty({
  reservation,
  party,
  partyMembers,
  partyBlocked,
}: {
  reservation: Reservation | null;
  party: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
    data: ReservationParty | null;
  };
  partyMembers: ReservationPartyMember[];
  partyBlocked: boolean;
}) {
  const { t } = useI18n();

  return (
    <Stack spacing={3}>
      <HStack justify="space-between" wrap="wrap">
        <Text fontSize="sm" color="gray.600">
          {t('checkIn.party.help')}
        </Text>
        {party.data !== null && (
          <Badge colorScheme={partyBlocked ? 'danger' : 'mint'} textTransform="none">
            {partyBlocked ? t('checkIn.party.blockedBadge') : t('checkIn.party.okBadge')}
          </Badge>
        )}
      </HStack>
      <QueryFeedback
        loading={party.loading}
        error={party.error}
        onRetry={party.reload}
        isEmpty={party.data === null || partyMembers.length === 0}
        emptyText={t('checkIn.party.empty')}
      >
        <Stack spacing={2}>
          {partyMembers.map((member) => (
            <Box
              key={`${member.guestId}-${member.role}`}
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
            >
              <HStack justify="space-between" wrap="wrap">
                <Text fontSize="sm" fontWeight="semibold">
                  {member.fullName}
                </Text>
                <Badge colorScheme={member.role === 'PRIMARY' ? 'brand' : 'gray'}>
                  {member.role === 'PRIMARY'
                    ? t('checkIn.party.primary')
                    : t('checkIn.party.companion')}
                </Badge>
              </HStack>
              <Text fontSize="xs" color="gray.500">
                {documentLabel(member, t)}
                {member.phone !== null ? ` · ${member.phone}` : ''}
                {member.email !== null ? ` · ${member.email}` : ''}
              </Text>
              {member.ageGroup === 'MINOR' && (
                <Text fontSize="xs" color="warning.700">
                  {t('checkIn.party.minor', {
                    supervision: member.minorSupervision ?? t('checkIn.party.noSupervision'),
                  })}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      </QueryFeedback>
      {partyBlocked && (
        <Text fontSize="sm" color="danger.600">
          {t('checkIn.party.blockedNote')}
        </Text>
      )}
      {reservation !== null && (
        <Button
          as={NextLink}
          href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
          size="xs"
          variant="link"
        >
          {t('checkIn.party.openGuest')}
        </Button>
      )}
    </Stack>
  );
}
