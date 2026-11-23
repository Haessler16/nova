'use client';

import { Alert, AlertIcon, Box, HStack, Text } from '@chakra-ui/react';
import { formatDateTime, instructionStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type {
  InstructionEvent,
  InstructionStatus,
  ReservationInstruction,
} from '@/lib/types';
import { StatusBadge } from '../ui';
import { InstructionActions } from './instruction-actions';
import { InstructionBadges } from './instruction-badges';
import { InstructionEvents } from './instruction-events';
import { INSTRUCTION_STATUS_COLORS } from '@/lib/format';

export function InstructionCard({
  instruction,
  canManage,
  busyAction,
  events,
  eventsLoading,
  onTransition,
  onToggleEvents,
  onEdit,
}: {
  instruction: ReservationInstruction;
  canManage: boolean;
  busyAction: string | null;
  events: InstructionEvent[] | undefined;
  eventsLoading: boolean;
  onTransition: (
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ) => void;
  onToggleEvents: (instruction: ReservationInstruction) => void;
  onEdit: (instruction: ReservationInstruction) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
      <HStack justify="space-between" align="start" wrap="wrap">
        <Box>
          <InstructionBadges instruction={instruction} />
          <Text fontWeight="semibold" mt={1}>
            {instruction.title}
          </Text>
        </Box>
        <StatusBadge
          color={INSTRUCTION_STATUS_COLORS[instruction.status]}
          label={instructionStatusLabel(locale, instruction.status)}
        />
      </HStack>
      <Text fontSize="sm" mt={2} whiteSpace="pre-wrap">
        {instruction.body}
      </Text>
      {instruction.actionType === 'PAYMENT_PREAUTHORIZATION' && (
        <Alert status="warning" mt={2} borderRadius="md" py={1}>
          <AlertIcon />
          <Text fontSize="xs">{t('instructions.preauthorization')}</Text>
        </Alert>
      )}
      <Text fontSize="xs" color="gray.500" mt={1}>
        {instruction.assignedDepartment !== null ? `${instruction.assignedDepartment} · ` : ''}
        {instructionStatusLabel(locale, instruction.status)} ·
        {formatDateTime(instruction.createdAt)}
      </Text>
      {(instruction.validFrom !== null || instruction.validUntil !== null) && (
        <Text fontSize="xs" color="gray.500">
          {t('instructions.validity', {
            from: instruction.validFrom !== null ? formatDateTime(instruction.validFrom) : '—',
            to: instruction.validUntil !== null ? formatDateTime(instruction.validUntil) : '—',
          })}
        </Text>
      )}

      <InstructionActions
        instruction={instruction}
        canManage={canManage}
        busyAction={busyAction}
        showEvents={events === undefined}
        eventsLoading={eventsLoading}
        onTransition={onTransition}
        onToggleEvents={onToggleEvents}
        onEdit={onEdit}
      />

      {events !== undefined && <InstructionEvents events={events} />}
    </Box>
  );
}
