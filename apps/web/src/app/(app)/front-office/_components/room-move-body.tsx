'use client';

import { Box, SimpleGrid, Stack, Text, Textarea } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomMoveController } from '../_hooks/use-room-move';
import { adultsLabel, minorsLabel, nightsLabel } from '../_lib/front-office.types';
import { MoveCandidatesTable } from './room-move-candidates';
import { MoveCompare } from './room-move-compare';
import { MoveFiltersGrid, MoveSearchRow } from './room-move-filters';

export function RoomMoveBody({ move }: { move: RoomMoveController }) {
  const { t } = useI18n();
  const target = move.target;
  if (target === null) {
    return null;
  }

  return (
    <Stack spacing={4}>
      <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
          <Box>
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.move.guest')}
            </Text>
            <Text fontSize="sm" fontWeight="semibold">
              {target.guest.fullName}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {target.reservation.code} ·{' '}
              {formatCalendarDate(target.reservation.checkInDate)} →{' '}
              {formatCalendarDate(target.reservation.checkOutDate)} ·{' '}
              {nightsLabel(t, target.reservation.nights)}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {adultsLabel(t, target.reservation.adults)} ·{' '}
              {minorsLabel(t, target.reservation.children)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.move.currentRoom')}
            </Text>
            <Text fontSize="sm" fontWeight="semibold">
              {t('frontOffice.rack.room', { number: target.room.number })} ·{' '}
              {target.reservation.roomType.name}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.move.floor', {
                floor: target.room.floor ?? '—',
                building: target.room.building ?? '—',
              })}
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      {move.loading && (
        <Text fontSize="sm" color="gray.500">
          {t('frontOffice.move.searching')}
        </Text>
      )}
      {move.loadError !== null && (
        <Text fontSize="sm" color="danger.600">
          {errorMessage(move.loadError)}
        </Text>
      )}

      {move.data !== null && (
        <>
          <MoveFiltersGrid
            filters={move.filters}
            options={move.options}
            onChange={move.updateFilter}
          />
          <MoveSearchRow
            filters={move.filters}
            onChange={move.updateFilter}
            filteredCount={move.filtered.length}
            totalCount={move.rooms.length}
          />
          <MoveCandidatesTable
            rooms={move.rooms}
            filtered={move.filtered}
            roomId={move.roomId}
            onSelect={move.selectRoom}
          />
          {move.errors['move.roomId'] !== undefined && (
            <Text fontSize="xs" color="danger.600">
              {move.errors['move.roomId']}
            </Text>
          )}
          {move.selected !== null && (
            <MoveCompare data={move.data} selected={move.selected} />
          )}
          <Field
            label={t('frontOffice.move.reason')}
            isRequired
            error={move.errors['move.reason']}
            helper={t('frontOffice.move.reasonHelper')}
          >
            <Textarea
              size="sm"
              rows={2}
              value={move.reason}
              maxLength={500}
              onChange={(event) => move.setReason(event.target.value)}
              required
            />
          </Field>
        </>
      )}
    </Stack>
  );
}
