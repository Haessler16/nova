'use client';

import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import { housekeepingLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomMoveCandidates, RoomMoveCandidate } from '@/lib/types';

export function MoveCompare({
  data,
  selected,
}: {
  data: RoomMoveCandidates;
  selected: RoomMoveCandidate;
}) {
  const { t, locale } = useI18n();

  return (
    <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
      <Text fontSize="sm" fontWeight="semibold" mb={2}>
        {t('frontOffice.move.compare')}
      </Text>
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
        <Box>
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.move.actual')}
          </Text>
          <Text fontSize="sm">
            {t('frontOffice.rack.room', { number: data.stay.room.number })} ·{' '}
            {data.stay.room.roomType.name}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.move.floor', {
              floor: data.stay.room.floor ?? '—',
              building: data.stay.room.building ?? '—',
            })}{' '}
            · {housekeepingLabel(locale, data.stay.room.housekeepingState)}
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.move.destination')}
          </Text>
          <Text fontSize="sm">
            {t('frontOffice.rack.room', { number: selected.number })} ·{' '}
            {selected.roomType.name}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.move.floor', {
              floor: selected.floor ?? '—',
              building: selected.building ?? '—',
            })}{' '}
            · {housekeepingLabel(locale, selected.housekeepingState)}
          </Text>
        </Box>
      </SimpleGrid>
      {selected.warnings.map((warning) => (
        <Text key={warning.code} fontSize="xs" color="warning.700" mt={2}>
          {t('frontOffice.move.housekeepingWarning', {
            state: housekeepingLabel(locale, selected.housekeepingState).toLowerCase(),
          })}
        </Text>
      ))}
    </Box>
  );
}
