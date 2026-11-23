'use client';

import { Badge, Box, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { KeyValue } from '@/components/ui';
import {
  BLOCK_TYPE_LABELS,
  HOUSEKEEPING_LABELS,
  OCCUPANCY_LABELS,
  OPERATIONAL_LABELS,
  formatCalendarDate,
  formatDateTime,
} from '@/lib/format';
import type { Room } from '@/lib/types';

export function RoomDetailOverview({ room }: { room: Room }) {
  return (
    <>
      <SimpleGrid columns={2} spacing={3}>
        <KeyValue label="Housekeeping" value={HOUSEKEEPING_LABELS[room.housekeepingState]} />
        <KeyValue label="Operativo" value={OPERATIONAL_LABELS[room.operationalState]} />
        <KeyValue label="Ocupación" value={OCCUPANCY_LABELS[room.occupancy]} />
        <KeyValue
          label="Capacidad"
          value={`${room.roomType.capacityAdults} adulto(s)${
            room.roomType.capacityChildren > 0
              ? ` + ${room.roomType.capacityChildren} menor(es)`
              : ''
          }`}
        />
        <KeyValue label="Piso" value={room.floor ?? '—'} />
        <KeyValue label="Ala / edificio" value={room.building ?? '—'} />
        <KeyValue label="Última modificación" value={formatDateTime(room.updatedAt)} />
        <KeyValue label="Modificado por" value={room.updatedBy?.name ?? 'Sistema'} />
      </SimpleGrid>

      <Box>
        <Text fontWeight="semibold" mb={2}>
          Estancia y reserva
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
            Sin estancia en casa.
          </Text>
        )}
        {room.nextArrival !== null && (
          <Text fontSize="sm" color="textPrimary" mt={2}>
            Próxima llegada: {room.nextArrival.guestName} · {room.nextArrival.code} ·{' '}
            {formatCalendarDate(room.nextArrival.checkInDate)}
          </Text>
        )}
        {room.activeBlock !== null && (
          <Text fontSize="sm" color="warning.600" mt={2}>
            Bloqueo activo ({BLOCK_TYPE_LABELS[room.activeBlock.type]}) hasta{' '}
            {formatDateTime(room.activeBlock.endsAt)}
          </Text>
        )}
      </Box>
    </>
  );
}
