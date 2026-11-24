'use client';

import { Box, Divider, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation, ReservationInstruction } from '@/lib/types';
import { InstructionCard } from './instruction-card';
import { adultsLabel, minorsLabel, nightsLabel } from './lib/check-in-labels';
import { SummaryRow } from './summary-row';

export function StepReservation({
  reservation,
  instructions,
  relevantInstructions,
  instructionBusyId,
  onAcknowledge,
}: {
  reservation: Reservation;
  instructions: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
  };
  relevantInstructions: ReservationInstruction[];
  instructionBusyId: string | null;
  onAcknowledge: (instruction: ReservationInstruction) => void;
}) {
  const { t } = useI18n();

  return (
    <Stack spacing={3}>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
        <SummaryRow label={t('checkIn.summary.guest')} value={reservation.guest.fullName} />
        <SummaryRow label={t('checkIn.summary.reservation')} value={reservation.code} />
        <SummaryRow
          label={t('checkIn.summary.arrival')}
          value={formatCalendarDate(reservation.checkInDate)}
        />
        <SummaryRow
          label={t('checkIn.summary.departure')}
          value={formatCalendarDate(reservation.checkOutDate)}
        />
        <SummaryRow
          label={t('checkIn.summary.occupancy')}
          value={`${adultsLabel(t, reservation.adults)}${
            reservation.children > 0 ? ` · ${minorsLabel(t, reservation.children)}` : ''
          }`}
        />
        <SummaryRow
          label={t('checkIn.summary.roomType')}
          value={t('checkIn.summary.roomTypeValue', {
            type: reservation.roomType.name,
            nights: nightsLabel(t, reservation.nights),
          })}
        />
      </SimpleGrid>
      {reservation.notes !== null && reservation.notes.trim() !== '' && (
        <Box borderLeftWidth="3px" borderColor="sky.300" pl={3}>
          <Text fontSize="xs" color="gray.500">
            {t('checkIn.notes')}
          </Text>
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {reservation.notes}
          </Text>
        </Box>
      )}
      <Divider />
      <Text fontWeight="semibold" fontSize="sm">
        {t('checkIn.instructions.title')}
      </Text>
      <Text fontSize="xs" color="gray.500">
        {t('checkIn.instructions.help')}
      </Text>
      <QueryFeedback
        loading={instructions.loading}
        error={instructions.error}
        onRetry={instructions.reload}
        isEmpty={relevantInstructions.length === 0}
        emptyText={t('checkIn.instructions.empty')}
      >
        <Stack spacing={2}>
          {relevantInstructions.map((instruction) => (
            <InstructionCard
              key={instruction.id}
              instruction={instruction}
              busy={instructionBusyId === instruction.id}
              onAcknowledge={() => onAcknowledge(instruction)}
            />
          ))}
        </Stack>
      </QueryFeedback>
    </Stack>
  );
}
