'use client';

import { Button, HStack } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { InstructionStatus, ReservationInstruction } from '@/lib/types';
import { STATUS_ACTIONS, canTransition } from './instruction-options';

export function InstructionActions({
  instruction,
  canManage,
  busyAction,
  showEvents,
  eventsLoading,
  onTransition,
  onToggleEvents,
  onEdit,
}: {
  instruction: ReservationInstruction;
  canManage: boolean;
  busyAction: string | null;
  showEvents: boolean;
  eventsLoading: boolean;
  onTransition: (
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ) => void;
  onToggleEvents: (instruction: ReservationInstruction) => void;
  onEdit: (instruction: ReservationInstruction) => void;
}) {
  const { t } = useI18n();

  return (
    <HStack mt={3} spacing={2} wrap="wrap">
      {canManage && canTransition(instruction.status, 'COMPLETED') && (
        <>
          {STATUS_ACTIONS.filter((action) =>
            canTransition(instruction.status, action.status),
          ).map((action) => (
            <Button
              key={action.path}
              size="xs"
              variant={action.variant ?? 'outline'}
              colorScheme={action.status === 'DISMISSED' ? 'gray' : 'brand'}
              isLoading={busyAction === `${instruction.id}:${action.status}`}
              onClick={() => onTransition(instruction, action.path, action.status)}
            >
              {t(action.labelKey)}
            </Button>
          ))}
          <Button size="xs" variant="ghost" onClick={() => onEdit(instruction)}>
            {t('reservations.row.edit')}
          </Button>
        </>
      )}
      <Button
        size="xs"
        variant="ghost"
        isLoading={eventsLoading}
        onClick={() => onToggleEvents(instruction)}
      >
        {showEvents ? t('instructions.history.show') : t('instructions.history.hide')}
      </Button>
    </HStack>
  );
}
