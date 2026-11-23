'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type {
  InstructionEvent,
  InstructionStatus,
  ReservationInstruction,
  ReservationSourceNote,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { eventLabel } from './instruction-options';

export function useInstructionList(reservationId: string, onChanged?: () => void) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();

  const [showCompleted, setShowCompleted] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, InstructionEvent[]>>({});
  const [eventsLoading, setEventsLoading] = useState<string | null>(null);

  const list = useAsyncData<{ items: ReservationInstruction[] }>(
    () =>
      api<{ items: ReservationInstruction[] }>(
        `/api/v1/reservations/${reservationId}/instructions?limit=100${
          showCompleted ? '&includeCompleted=true' : ''
        }`,
        { tenant },
      ),
    `${reservationId}:${String(showCompleted)}`,
  );

  const sourceNotes = useAsyncData<{ items: ReservationSourceNote[] }>(
    () =>
      api<{ items: ReservationSourceNote[] }>(
        `/api/v1/reservations/${reservationId}/source-notes`,
        { tenant },
      ),
    `${reservationId}:source-notes`,
  );

  function notifyChanged(): void {
    list.reload();
    sourceNotes.reload();
    // Cached timelines may be stale after a transition or edit.
    setEvents({});
    onChanged?.();
  }

  async function handleTransition(
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ): Promise<void> {
    setBusyAction(`${instruction.id}:${status}`);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions/${instruction.id}/${path}`, {
        method: 'POST',
        tenant,
        body: {},
      });
      notifyChanged();
    } catch (cause) {
      toast({
        title: t('instructions.toast.transitionError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleEvents(instruction: ReservationInstruction): Promise<void> {
    if (events[instruction.id] !== undefined) {
      setEvents((current) => {
        const next = { ...current };
        delete next[instruction.id];
        return next;
      });
      return;
    }
    setEventsLoading(instruction.id);
    try {
      const result = await api<{ items: InstructionEvent[] }>(
        `/api/v1/reservations/${reservationId}/instructions/${instruction.id}/events`,
        { tenant },
      );
      setEvents((current) => ({ ...current, [instruction.id]: result.items }));
    } catch (cause) {
      toast({
        title: t('instructions.toast.eventsError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setEventsLoading(null);
    }
  }

  const items = list.data?.items ?? [];
  const actions = items.filter((instruction) => instruction.actionType !== null);
  const information = items.filter((instruction) => instruction.actionType === null);
  const highlighted = items.filter(
    (instruction) => instruction.priority === 'HIGH' || instruction.priority === 'CRITICAL',
  );
  const pendingCount = items.filter(
    (instruction) => instruction.status !== 'COMPLETED' && instruction.status !== 'DISMISSED',
  ).length;

  return {
    list,
    sourceNotes,
    showCompleted,
    setShowCompleted,
    busyAction,
    events,
    eventsLoading,
    items,
    actions,
    information,
    highlighted,
    pendingCount,
    notifyChanged,
    handleTransition,
    toggleEvents,
    eventLabel,
  };
}

export type InstructionList = ReturnType<typeof useInstructionList>;
