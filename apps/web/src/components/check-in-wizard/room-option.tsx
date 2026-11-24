'use client';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import { StatusBadge } from '@/components/ui';
import {
  HOUSEKEEPING_COLORS,
  OPERATIONAL_COLORS,
  checkInBlockReasonLabel,
  formatDateTime,
  housekeepingLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CheckInRoomOption } from '@/lib/types';

export function RoomOption({
  room,
  selected,
  roomTypeName,
  actorId,
  roomBusyId,
  onSelect,
}: {
  room: CheckInRoomOption;
  selected: boolean;
  roomTypeName: string | undefined;
  actorId: string | undefined;
  roomBusyId: string | null;
  onSelect: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'brand.400' : 'gray.200'}
      bg={selected ? 'brand.50' : undefined}
      borderRadius="md"
      px={3}
      py={2}
    >
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" fontWeight="semibold">
              {t('frontOffice.rack.room', { number: room.number })}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {roomTypeName}
              {room.floor !== null ? t('checkIn.room.floor', { floor: room.floor }) : ''}
            </Text>
            <StatusBadge
              color={HOUSEKEEPING_COLORS[room.housekeepingState]}
              label={housekeepingLabel(locale, room.housekeepingState)}
            />
            {room.operationalState !== 'AVAILABLE' && (
              <StatusBadge
                color={OPERATIONAL_COLORS[room.operationalState]}
                label={roomOperationalLabel(locale, room.operationalState)}
              />
            )}
            {room.occupancy === 'OCCUPIED' && (
              <Badge colorScheme="warning" textTransform="none">
                {t('checkIn.room.occupied')}
              </Badge>
            )}
          </HStack>
          {room.reasons.length > 0 && (
            <Text fontSize="xs" color="danger.600" mt={1}>
              {room.reasons.map((reason) => checkInBlockReasonLabel(locale, reason)).join(' · ')}
            </Text>
          )}
          {room.activeBlock !== null && (
            <Text fontSize="xs" color="gray.500" mt={0.5}>
              {t('checkIn.room.block', { time: formatDateTime(room.activeBlock.endsAt) })}
            </Text>
          )}
          {room.lease !== null && (
            <Text
              fontSize="xs"
              color={room.lease.ownerUserId === actorId ? 'brand.600' : 'warning.600'}
              mt={0.5}
            >
              {room.lease.ownerUserId === actorId
                ? t('checkIn.room.leaseOwn')
                : t('checkIn.room.leaseOther', { name: room.lease.ownerDisplayName })}
              {' · '}
              {t('checkIn.room.leaseExpires', { time: formatDateTime(room.lease.expiresAt) })}
            </Text>
          )}
        </Box>
        <Button
          size="xs"
          variant={selected ? 'solid' : 'outline'}
          colorScheme={selected ? 'brand' : 'gray'}
          isDisabled={
            !room.eligible ||
            roomBusyId !== null ||
            (room.lease !== null && room.lease.ownerUserId !== actorId)
          }
          isLoading={roomBusyId === room.id}
          onClick={onSelect}
        >
          {selected ? t('checkIn.room.selected') : t('checkIn.room.choose')}
        </Button>
      </HStack>
    </Box>
  );
}
