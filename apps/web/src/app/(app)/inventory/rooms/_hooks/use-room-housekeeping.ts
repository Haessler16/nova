'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { HOUSEKEEPING_LABELS } from '@/lib/format';
import type { HousekeepingState, Room } from '@/lib/types';

export function useRoomHousekeeping(
  selectedRoomId: string | null,
  reload: () => void,
  bumpDetail: () => void,
) {
  const { tenant } = useSession();
  const toast = useToast();

  const [transitioning, setTransitioning] = useState(false);
  const [reason, setReason] = useState('');

  function reset(): void {
    setReason('');
  }

  async function transition(state: HousekeepingState): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    setTransitioning(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}/housekeeping-transitions`, {
        method: 'POST',
        tenant,
        body: {
          state,
          ...(reason.trim() !== '' ? { reason: reason.trim() } : {}),
        },
      });
      toast({ title: `Housekeeping: ${HOUSEKEEPING_LABELS[state]}`, status: 'success' });
      setReason('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'Transición rechazada',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setTransitioning(false);
    }
  }

  return { reason, setReason, transitioning, transition, reset };
}

export type RoomHousekeeping = ReturnType<typeof useRoomHousekeeping>;
