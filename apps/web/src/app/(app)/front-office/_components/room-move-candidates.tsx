'use client';

import {
  Button,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {
  HOUSEKEEPING_COLORS,
  formatDateTime,
  housekeepingLabel,
  occupancyLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomMoveCandidate } from '@/lib/types';
import { StatusBadge } from '@/components/ui';
import { blockTypeLabel, roomMoveBlockerLabel } from '../_lib/front-office.types';

function MoveCandidateRow({
  room,
  roomId,
  onSelect,
}: {
  room: RoomMoveCandidate;
  roomId: string;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Tr opacity={room.eligible ? 1 : 0.65}>
      <Td fontWeight="semibold">{room.number}</Td>
      <Td>
        <Text fontSize="xs">{room.roomType.name}</Text>
        <Text fontSize="xs" color="gray.500">
          {room.roomType.capacityAdults}A / {room.roomType.capacityChildren}N
        </Text>
      </Td>
      <Td>
        <Text fontSize="xs">{room.floor ?? '—'}</Text>
        <Text fontSize="xs" color="gray.500">
          {room.building ?? '—'}
        </Text>
      </Td>
      <Td>
        <StatusBadge
          color={HOUSEKEEPING_COLORS[room.housekeepingState]}
          label={housekeepingLabel(locale, room.housekeepingState)}
        />
      </Td>
      <Td>
        <Text fontSize="xs">
          {occupancyLabel(locale, room.occupancy)} ·{' '}
          {roomOperationalLabel(locale, room.operationalState)}
        </Text>
        {room.activeBlock !== null && (
          <Text fontSize="xs" color="danger.600">
            {t('frontOffice.move.block', {
              type: blockTypeLabel(t, room.activeBlock.type),
              time: formatDateTime(room.activeBlock.endsAt),
            })}
          </Text>
        )}
        {room.blockers.map((blocker) => (
          <Text key={blocker.code} fontSize="xs" color="danger.600">
            {roomMoveBlockerLabel(t, blocker.code)}
          </Text>
        ))}
      </Td>
      <Td
        isNumeric
        position="sticky"
        right={0}
        bg="surface"
        borderLeftWidth="1px"
        borderLeftColor="line"
      >
        <Button
          size="xs"
          variant={roomId === room.id ? 'solid' : 'outline'}
          colorScheme="brand"
          isDisabled={!room.eligible}
          onClick={() => onSelect(room.id)}
        >
          {roomId === room.id ? t('frontOffice.move.chosen') : t('frontOffice.move.choose')}
        </Button>
      </Td>
    </Tr>
  );
}

export function MoveCandidatesTable({
  rooms,
  filtered,
  roomId,
  onSelect,
}: {
  rooms: RoomMoveCandidate[];
  filtered: RoomMoveCandidate[];
  roomId: string;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();

  if (rooms.length === 0) {
    return (
      <Text fontSize="sm" color="warning.700">
        {t('frontOffice.move.noRooms')}
      </Text>
    );
  }
  if (filtered.length === 0) {
    return (
      <Text fontSize="sm" color="warning.700">
        {t('frontOffice.move.noMatches')}
      </Text>
    );
  }

  return (
    <TableContainer
      maxH="320px"
      overflowX="auto"
      overflowY="auto"
      borderWidth="1px"
      borderColor="line"
      borderRadius="md"
    >
      <Table size="sm" minW="720px">
        <Thead>
          <Tr>
            <Th>{t('frontOffice.move.tableRoom')}</Th>
            <Th>{t('frontOffice.move.tableType')}</Th>
            <Th>{t('frontOffice.move.tableFloor')}</Th>
            <Th>{t('frontOffice.move.tableHousekeeping')}</Th>
            <Th>{t('frontOffice.move.tableState')}</Th>
            <Th
              position="sticky"
              right={0}
              zIndex={1}
              bg="surface"
              borderLeftWidth="1px"
              borderLeftColor="line"
            >
              {t('frontOffice.move.tableAction')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {filtered.map((room) => (
            <MoveCandidateRow
              key={room.id}
              room={room}
              roomId={roomId}
              onSelect={onSelect}
            />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
