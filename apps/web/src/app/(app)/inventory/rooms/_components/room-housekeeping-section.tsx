'use client';

import { Box, Button, HStack, Input, Text } from '@chakra-ui/react';
import { HOUSEKEEPING_TRANSITIONS, housekeepingLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Room } from '@/lib/types';
import type { RoomHousekeeping } from '../_hooks/use-room-housekeeping';

export function RoomHousekeepingSection({
  room,
  housekeeping,
}: {
  room: Room;
  housekeeping: RoomHousekeeping;
}) {
  const { t, locale } = useI18n();
  const nextHousekeeping = HOUSEKEEPING_TRANSITIONS[room.housekeepingState];

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('rooms.housekeeping.title')}
      </Text>
      <HStack mb={2}>
        <Input
          size="sm"
          placeholder={t('rooms.housekeeping.reasonPlaceholder')}
          value={housekeeping.reason}
          onChange={(event) => housekeeping.setReason(event.target.value)}
        />
      </HStack>
      <HStack wrap="wrap">
        {nextHousekeeping.length === 0 && (
          <Text fontSize="sm" color="textSecondary">
            {t('rooms.housekeeping.none')}
          </Text>
        )}
        {nextHousekeeping.map((state) => (
          <Button
            key={state}
            size="sm"
            variant="outline"
            isLoading={housekeeping.transitioning}
            onClick={() => void housekeeping.transition(state)}
          >
            → {housekeepingLabel(locale, state)}
          </Button>
        ))}
      </HStack>
    </Box>
  );
}
