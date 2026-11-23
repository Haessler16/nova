'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  SimpleGrid,
  TabPanel,
  Text,
} from '@chakra-ui/react';
import { SectionCard, StatusBadge } from '@/components/ui';
import {
  HOUSEKEEPING_COLORS,
  OPERATIONAL_COLORS,
  formatCalendarDate,
  formatDateTime,
  housekeepingLabel,
  occupancyLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, RoomRackItem, Stay } from '@/lib/types';

function RoomRackCard({
  room,
  inHouse,
  onIncident,
}: {
  room: RoomRackItem;
  inHouse: Stay[];
  onIncident: (stay?: Stay, room?: RoomRackItem) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Box
      borderWidth="1px"
      borderColor={room.occupancy === 'OCCUPIED' ? 'warning.300' : 'mint.200'}
      borderLeftWidth="4px"
      borderRadius="md"
      px={3}
      py={2}
      bg={room.occupancy === 'OCCUPIED' ? 'warning.50' : 'white'}
    >
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Text fontSize="sm" fontWeight="bold">
            {t('frontOffice.rack.room', { number: room.number })}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {room.roomType.name}
            {room.floor !== null ? t('frontOffice.rack.floor', { floor: room.floor }) : ''}
          </Text>
        </Box>
        <Badge colorScheme={room.occupancy === 'OCCUPIED' ? 'warning' : 'mint'} textTransform="none">
          {occupancyLabel(locale, room.occupancy)}
        </Badge>
      </HStack>
      <HStack spacing={1} mt={2} wrap="wrap">
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
        {room.activeBlock !== null && (
          <Badge colorScheme="danger" textTransform="none">
            {t('frontOffice.rack.block', {
              time: formatDateTime(room.activeBlock.endsAt),
            })}
          </Badge>
        )}
      </HStack>
      {room.currentStay !== null ? (
        <Box mt={2}>
          <Text fontSize="xs" fontWeight="medium">
            {room.currentStay.guestName}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {room.currentStay.code} ·{' '}
            {t('frontOffice.stay.checkout', {
              date: formatCalendarDate(room.currentStay.checkOutDate),
            })}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            mt={1}
            onClick={() => {
              const stay = inHouse.find((item) => item.id === room.currentStay?.id);
              if (stay !== undefined) {
                onIncident(stay);
              }
            }}
          >
            {t('frontOffice.rack.registerIncident')}
          </Button>
        </Box>
      ) : room.nextArrival !== null ? (
        <Text fontSize="xs" color="gray.500" mt={2}>
          {t('frontOffice.rack.nextArrival', {
            name: room.nextArrival.guestName,
            date: formatCalendarDate(room.nextArrival.checkInDate),
          })}
        </Text>
      ) : (
        <HStack justify="space-between" mt={2}>
          <Text fontSize="xs" color="gray.400">
            {t('frontOffice.rack.noStay')}
          </Text>
          <Button size="xs" variant="ghost" onClick={() => onIncident(undefined, room)}>
            {t('frontOffice.rack.note')}
          </Button>
        </HStack>
      )}
    </Box>
  );
}

export function RoomRackPanel({
  data,
  inHouse,
  onIncident,
}: {
  data: FrontOfficeOverview;
  inHouse: Stay[];
  onIncident: (stay?: Stay, room?: RoomRackItem) => void;
}) {
  const { t } = useI18n();
  return (
    <TabPanel px={0} hidden={data.isHistorical}>
      <SectionCard>
        <HStack justify="space-between" mb={3} wrap="wrap">
          <Box>
            <Text fontWeight="semibold">{t('frontOffice.rack.title')}</Text>
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.rack.help')}
            </Text>
          </Box>
          <HStack spacing={3}>
            <HStack spacing={1}>
              <Box boxSize="10px" borderRadius="full" bg="mint.500" />
              <Text fontSize="xs" color="gray.600">
                {t('frontOffice.rack.free')}
              </Text>
            </HStack>
            <HStack spacing={1}>
              <Box boxSize="10px" borderRadius="full" bg="warning.500" />
              <Text fontSize="xs" color="gray.600">
                {t('frontOffice.rack.occupied')}
              </Text>
            </HStack>
          </HStack>
        </HStack>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={3}>
          {data.roomRack.map((room) => (
            <RoomRackCard key={room.id} room={room} inHouse={inHouse} onIncident={onIncident} />
          ))}
        </SimpleGrid>
      </SectionCard>
    </TabPanel>
  );
}
