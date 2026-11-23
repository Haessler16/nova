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
  HOUSEKEEPING_LABELS,
  OCCUPANCY_COLORS,
  OCCUPANCY_LABELS,
  OPERATIONAL_COLORS,
  OPERATIONAL_LABELS,
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  formatCalendarDate,
  formatDateTime,
} from '@/lib/format';
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
  return (
    <Tr>
      <Td>
        <Text fontWeight="semibold">{room.number}</Text>
        {room.status !== 'ACTIVE' && (
          <StatusBadge
            color={RECORD_STATUS_COLORS[room.status] ?? 'gray'}
            label={RECORD_STATUS_LABELS[room.status] ?? room.status}
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
          {room.roomType.capacityAdults} adulto(s)
          {room.roomType.capacityChildren > 0
            ? ` + ${room.roomType.capacityChildren} menor(es)`
            : ''}
        </Text>
      </Td>
      <Td>
        {[room.floor, room.building].filter((value) => value !== null).join(' / ') || '—'}
      </Td>
      <Td>
        <StatusBadge
          color={OCCUPANCY_COLORS[room.occupancy]}
          label={OCCUPANCY_LABELS[room.occupancy]}
        />
        {room.currentStay !== null && (
          <Box mt={1}>
            <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
              {room.currentStay.guestName}
            </Text>
            <Text fontSize="xs" color="textSecondary" noOfLines={1}>
              {room.currentStay.code} · hasta {formatCalendarDate(room.currentStay.checkOutDate)}
            </Text>
          </Box>
        )}
        {room.currentStay === null && room.nextArrival !== null && (
          <Text fontSize="xs" color="textSecondary" mt={1} noOfLines={1}>
            Próx. {room.nextArrival.code} · {formatCalendarDate(room.nextArrival.checkInDate)}
          </Text>
        )}
        {room.lease !== null && (
          <Text fontSize="xs" color="warning.600" mt={1}>
            En selección: {room.lease.ownerDisplayName}
          </Text>
        )}
      </Td>
      <Td>
        <StatusBadge
          color={HOUSEKEEPING_COLORS[room.housekeepingState]}
          label={HOUSEKEEPING_LABELS[room.housekeepingState]}
        />
      </Td>
      <Td>
        <StatusBadge
          color={OPERATIONAL_COLORS[room.operationalState]}
          label={OPERATIONAL_LABELS[room.operationalState]}
        />
        {room.activeBlock !== null && (
          <Text fontSize="xs" color="textSecondary" mt={1}>
            Bloqueo hasta {formatDateTime(room.activeBlock.endsAt)}
          </Text>
        )}
      </Td>
      <Td>
        <Text fontSize="xs">{formatDateTime(room.updatedAt)}</Text>
        <Text fontSize="xs" color="textSecondary" noOfLines={1}>
          {room.updatedBy?.name ?? 'Sistema'}
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
          <RowActionButton onClick={() => onDetail(room)}>Detalle</RowActionButton>
          <RowActionButton onClick={() => onEdit(room)}>Editar</RowActionButton>
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
  return (
    <TableContainer overflowX="auto">
      <Table size="sm" minW="1065px" sx={{ tableLayout: 'fixed' }}>
        <Thead>
          <Tr>
            <Th width="130px">UH</Th>
            <Th width="155px">Tipo / capacidad</Th>
            <Th width="95px">Piso / ala</Th>
            <Th width="225px">Ocupación</Th>
            <Th width="110px">Housekeeping</Th>
            <Th width="125px">Operativo</Th>
            <Th width="115px">Actualizada</Th>
            <Th width="110px" position="sticky" right={0} bg="gray.50" zIndex={1}>
              Acciones
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
