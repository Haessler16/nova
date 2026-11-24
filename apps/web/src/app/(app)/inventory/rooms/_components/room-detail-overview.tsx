'use client';

import { Badge, Box, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { KeyValue } from '@/components/ui';
import {
  blockTypeLabel,
  formatCalendarDate,
  formatDateTime,
  housekeepingLabel,
  occupancyLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Room } from '@/lib/types';

export function RoomDetailOverview({ room }: { room: Room }) {
  const { t, locale } = useI18n();

  return (
    <>
      <SimpleGrid columns={2} spacing={3}>
        <KeyValue
          label={t('rooms.overview.housekeeping')}
          value={housekeepingLabel(locale, room.housekeepingState)}
        />
        <KeyValue
          label={t('rooms.overview.operational')}
          value={roomOperationalLabel(locale, room.operationalState)}
        />
        <KeyValue
          label={t('rooms.overview.occupancy')}
          value={occupancyLabel(locale, room.occupancy)}
        />
        <KeyValue
          label={t('rooms.overview.capacity')}
          value={`${t('rooms.table.adults', { count: room.roomType.capacityAdults })}${
            room.roomType.capacityChildren > 0
              ? t('rooms.table.children', { count: room.roomType.capacityChildren })
              : ''
          }`}
        />
        <KeyValue label={t('rooms.overview.floor')} value={room.floor ?? '—'} />
        <KeyValue label={t('rooms.overview.building')} value={room.building ?? '—'} />
        <KeyValue label={t('rooms.overview.updatedAt')} value={formatDateTime(room.updatedAt)} />
        <KeyValue
          label={t('rooms.overview.updatedBy')}
          value={room.updatedBy?.name ?? t('rooms.table.system')}
        />
      </SimpleGrid>

      <Box>
        <Text fontWeight="semibold" mb={2}>
          {t('rooms.overview.stay')}
        </Text>
        {room.currentStay !== null ? (
          <Stack spacing={1}>
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="medium">
                {room.currentStay.guestName}
              </Text>
              <Badge colorScheme="brand">{room.currentStay.code}</Badge>
            </HStack>
            <Text fontSize="sm">
              {formatCalendarDate(room.currentStay.checkInDate)} →{' '}
              {formatCalendarDate(room.currentStay.checkOutDate)}
            </Text>
          </Stack>
        ) : (
          <Text fontSize="sm" color="textSecondary">
            {t('rooms.overview.noStay')}
          </Text>
        )}
        {room.nextArrival !== null && (
          <Text fontSize="sm" color="textPrimary" mt={2}>
            {t('rooms.overview.nextArrival', {
              name: room.nextArrival.guestName,
              code: room.nextArrival.code,
              date: formatCalendarDate(room.nextArrival.checkInDate),
            })}
          </Text>
        )}
        {room.activeBlock !== null && (
          <Text fontSize="sm" color="warning.600" mt={2}>
            {t('rooms.overview.activeBlock', {
              type: blockTypeLabel(locale, room.activeBlock.type),
              date: formatDateTime(room.activeBlock.endsAt),
            })}
          </Text>
        )}
      </Box>
    </>
  );
}
