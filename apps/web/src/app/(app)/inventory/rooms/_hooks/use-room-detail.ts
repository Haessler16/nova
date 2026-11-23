'use client';

import { useReducer } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { RoomBlock, RoomHistoryEntry } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

export function useRoomDetail(selectedRoomId: string | null) {
  const { tenant } = useSession();
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);

  const detail = useAsyncData<{ blocks: RoomBlock[]; history: RoomHistoryEntry[] }>(
    async () => {
      if (selectedRoomId === null) {
        return { blocks: [], history: [] };
      }
      const [blocks, history] = await Promise.all([
        api<{ items: RoomBlock[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, { tenant }),
        api<{ items: RoomHistoryEntry[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/history`, {
          tenant,
        }),
      ]);
      return { blocks: blocks.items, history: history.items };
    },
    `${selectedRoomId ?? 'none'}:${detailVersion}`,
  );

  return { detail, bumpDetail };
}

export type RoomDetail = ReturnType<typeof useRoomDetail>;
