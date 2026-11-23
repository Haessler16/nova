'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type {
  InstructionEvent,
  InstructionStatus,
  ReservationInstruction,
} from '@/lib/types';
import { InstructionCard } from './instruction-card';

export function InstructionsList({
  actions,
  information,
  canManage,
  busyAction,
  events,
  eventsLoading,
  onTransition,
  onToggleEvents,
  onEdit,
}: {
  actions: ReservationInstruction[];
  information: ReservationInstruction[];
  canManage: boolean;
  busyAction: string | null;
  events: Record<string, InstructionEvent[]>;
  eventsLoading: string | null;
  onTransition: (
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ) => void;
  onToggleEvents: (instruction: ReservationInstruction) => void;
  onEdit: (instruction: ReservationInstruction) => void;
}) {
  const { t } = useI18n();

  function renderCards(items: ReservationInstruction[]) {
    return (
      <Stack spacing={3}>
        {items.map((instruction) => (
          <InstructionCard
            key={instruction.id}
            instruction={instruction}
            canManage={canManage}
            busyAction={busyAction}
            events={events[instruction.id]}
            eventsLoading={eventsLoading === instruction.id}
            onTransition={onTransition}
            onToggleEvents={onToggleEvents}
            onEdit={onEdit}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <Box>
        <Text fontWeight="semibold" fontSize="sm" mb={2}>
          {t('instructions.section.actions')}
        </Text>
        {actions.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {t('instructions.noActions')}
          </Text>
        ) : (
          renderCards(actions)
        )}
      </Box>

      <Box>
        <Text fontWeight="semibold" fontSize="sm" mb={2}>
          {t('instructions.section.info')}
        </Text>
        {information.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {t('instructions.noInfo')}
          </Text>
        ) : (
          renderCards(information)
        )}
      </Box>
    </Stack>
  );
}
