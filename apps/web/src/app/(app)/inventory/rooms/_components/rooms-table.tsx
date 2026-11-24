'use client';

import {
  Box,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { RowActionButton, StatusBadge } from '@/components/ui';
import {
  HOUSEKEEPING_COLORS,
  OCCUPANCY_COLORS,
  OPERATIONAL_COLORS,
  RECORD_STATUS_COLORS,
  formatCalendarDate,
  formatDateTime,
  housekeepingLabel,
  occupancyLabel,
  recordStatusLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Room } from '@/lib/types';

function RoomRow({
  room,
  onDetail,
  onEdit,
}: {
  room: Room;
  onDetail: (room: Room) => void;
  onEdit: (room: Room) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Tr>
      <Td>
        <Text fontWeight="semibold">{room.number}</Text>
        {room.status !== 'ACTIVE' && (
          <StatusBadge
            color={RECORD_STATUS_COLORS[room.status] ?? 'gray'}
            label={recordStatusLabel(locale, room.status)}
          />
        )}
        {room.attributes.length > 0 && (
          <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="180px">
            {room.attributes.join(' · ')}
          </Text>
        )}
      </Td>
      <Td>
        <Text>{room.roomType.name}</Text>
        <Text fontSize="xs" color="textSecondary">
          {t('rooms.table.adults', { count: room.roomType.capacityAdults })}
          {room.roomType.capacityChildren > 0
            ? t('rooms.table.children', { count: room.roomType.capacityChildren })
            : ''}
        </Text>
      </Td>
      <Td>{[room.floor, room.building].filter((value) => value !== null).join(' / ') || '—'}</Td>
      <Td>
        <StatusBadge
          color={OCCUPANCY_COLORS[room.occupancy]}
          label={occupancyLabel(locale, room.occupancy)}
        />
        {room.currentStay !== null && (
          <Box mt={1}>
            <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
              {room.currentStay.guestName}
            </Text>
            <Text fontSize="xs" color="textSecondary" noOfLines={1}>
              {room.currentStay.code} ·{' '}
              {t('rooms.table.stayUntil', {
                date: formatCalendarDate(room.currentStay.checkOutDate),
              })}
            </Text>
          </Box>
        )}
        {room.currentStay === null && room.nextArrival !== null && (
          <Text fontSize="xs" color="textSecondary" mt={1} noOfLines={1}>
            {t('rooms.table.nextArrival', {
              code: room.nextArrival.code,
              date: formatCalendarDate(room.nextArrival.checkInDate),
            })}
          </Text>
        )}
        {room.lease !== null && (
          <Text fontSize="xs" color="warning.600" mt={1}>
            {t('rooms.table.inSelection', { name: room.lease.ownerDisplayName })}
          </Text>
        )}
      </Td>
      <Td>
        <StatusBadge
          color={HOUSEKEEPING_COLORS[room.housekeepingState]}
          label={housekeepingLabel(locale, room.housekeepingState)}
        />
      </Td>
      <Td>
        <StatusBadge
          color={OPERATIONAL_COLORS[room.operationalState]}
          label={roomOperationalLabel(locale, room.operationalState)}
        />
        {room.activeBlock !== null && (
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {t('rooms.table.blockUntil', { date: formatDateTime(room.activeBlock.endsAt) })}
          </Text>
        )}
      </Td>
      <Td>
        <Text fontSize="xs">{formatDateTime(room.updatedAt)}</Text>
        <Text fontSize="xs" color="textSecondary" noOfLines={1}>
          {room.updatedBy?.name ?? t('rooms.table.system')}
        </Text>
      </Td>
      <Td
        position="sticky"
        right={0}
        bg="white"
        zIndex={1}
        borderLeftWidth="1px"
        borderLeftColor="gray.100"
      >
        <HStack spacing={1} justify="flex-end" wrap="nowrap">
          <RowActionButton onClick={() => onDetail(room)}>
            {t('rooms.table.detail')}
          </RowActionButton>
          <RowActionButton onClick={() => onEdit(room)}>{t('rooms.table.edit')}</RowActionButton>
        </HStack>
      </Td>
    </Tr>
  );
}

export function RoomsTable({
  rooms,
  onDetail,
  onEdit,
}: {
  rooms: Room[];
  onDetail: (room: Room) => void;
  onEdit: (room: Room) => void;
}) {
  const { t } = useI18n();

  return (
    <TableContainer overflowX="auto">
      <Table size="sm" minW="1065px" sx={{ tableLayout: 'fixed' }}>
        <Thead>
          <Tr>
            <Th width="130px">{t('rooms.table.number')}</Th>
            <Th width="155px">{t('rooms.table.typeCapacity')}</Th>
            <Th width="95px">{t('rooms.table.floorBuilding')}</Th>
            <Th width="225px">{t('rooms.table.occupancy')}</Th>
            <Th width="110px">{t('rooms.table.housekeeping')}</Th>
            <Th width="125px">{t('rooms.table.operational')}</Th>
            <Th width="115px">{t('rooms.table.updatedAt')}</Th>
            <Th width="110px" position="sticky" right={0} bg="gray.50" zIndex={1}>
              {t('rooms.table.actions')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} onDetail={onDetail} onEdit={onEdit} />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
