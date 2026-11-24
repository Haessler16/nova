'use client';

import { Stack, Text } from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { CheckInReadiness, CheckInRoomOption } from '@/lib/types';
import { RoomOption } from './room-option';

export function StepRoom({
  readiness,
  rooms,
  selectedRoomId,
  roomTypeName,
  actorId,
  roomBusyId,
  onSelectRoom,
}: {
  readiness: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
    data: CheckInReadiness | null;
  };
  rooms: CheckInRoomOption[];
  selectedRoomId: string;
  roomTypeName: string | undefined;
  actorId: string | undefined;
  roomBusyId: string | null;
  onSelectRoom: (room: CheckInRoomOption) => void;
}) {
  const { t } = useI18n();

  return (
    <Stack spacing={3}>
      <Text fontSize="sm" color="gray.600">
        {t('checkIn.room.help')}
      </Text>
      <QueryFeedback
        loading={readiness.loading}
        error={readiness.error}
        onRetry={readiness.reload}
        isEmpty={readiness.data === null}
        emptyText={t('checkIn.room.loadError')}
      >
        {readiness.data !== null && (
          <Stack spacing={3}>
            {readiness.data.currentRoomEligible === false && (
              <Text fontSize="xs" color="warning.700">
                {t('checkIn.room.currentInvalid')}
              </Text>
            )}
            {rooms.length === 0 && (
              <Text fontSize="sm" color="warning.600">
                {t('checkIn.room.noActive')}
              </Text>
            )}
            <Stack spacing={2}>
              {rooms.map((room) => (
                <RoomOption
                  key={room.id}
                  room={room}
                  selected={selectedRoomId === room.id}
                  roomTypeName={roomTypeName}
                  actorId={actorId}
                  roomBusyId={roomBusyId}
                  onSelect={() => onSelectRoom(room)}
                />
              ))}
            </Stack>
          </Stack>
        )}
      </QueryFeedback>
    </Stack>
  );
}
