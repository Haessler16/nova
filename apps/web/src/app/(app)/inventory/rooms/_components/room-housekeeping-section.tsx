'use client';

import { Box, Button, HStack, Input, Text } from '@chakra-ui/react';
import { HOUSEKEEPING_LABELS, HOUSEKEEPING_TRANSITIONS } from '@/lib/format';
import type { Room } from '@/lib/types';
import type { RoomHousekeeping } from '../_hooks/use-room-housekeeping';

export function RoomHousekeepingSection({
  room,
  housekeeping,
}: {
  room: Room;
  housekeeping: RoomHousekeeping;
}) {
  const nextHousekeeping = HOUSEKEEPING_TRANSITIONS[room.housekeepingState];

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        Transición de housekeeping
      </Text>
      <HStack mb={2}>
        <Input
          size="sm"
          placeholder="Motivo (opcional)"
          value={housekeeping.reason}
          onChange={(event) => housekeeping.setReason(event.target.value)}
        />
      </HStack>
      <HStack wrap="wrap">
        {nextHousekeeping.length === 0 && (
          <Text fontSize="sm" color="textSecondary">
            Sin transiciones disponibles.
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
            → {HOUSEKEEPING_LABELS[state]}
          </Button>
        ))}
      </HStack>
    </Box>
  );
}
