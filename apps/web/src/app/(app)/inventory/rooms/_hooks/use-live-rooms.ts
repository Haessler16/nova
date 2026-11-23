'use client';

import { useEffect, useState } from 'react';
import { apiEventStream } from '@/lib/api';

export type LiveMode = 'connecting' | 'live' | 'polling';

/**
 * The SSE stream refreshes the rack as soon as another session changes a
 * room. When it cannot connect, polling every 15s keeps the rack usable.
 */
export function useLiveRooms(
  organizationId: string | null,
  propertyId: string | null,
  reloadSilent: () => void,
): LiveMode {
  const [liveMode, setLiveMode] = useState<LiveMode>('connecting');

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    let refreshTimer: number | undefined;

    function scheduleRefresh(): void {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        reloadSilent();
      }, 250);
    }

    async function run(): Promise<void> {
      try {
        setLiveMode('connecting');
        for await (const event of apiEventStream(
          '/api/v1/inventory/rooms/updates',
          { organizationId, propertyId },
          controller.signal,
        )) {
          attempts = 0;
          setLiveMode('live');
          if (
            event.type === 'ready' ||
            event.type === 'room.updated' ||
            event.type === 'room.housekeeping' ||
            event.type === 'room.block_changed' ||
            event.type === 'room.lease_changed'
          ) {
            scheduleRefresh();
          }
        }
      } catch {
        // Offline, expired session or a proxy that buffers streams.
      }
      if (disposed) {
        return;
      }
      setLiveMode('polling');
      attempts += 1;
      retryTimer = window.setTimeout(
        () => {
          retryTimer = undefined;
          void run();
        },
        Math.min(2_000 * attempts, 30_000),
      );
    }

    void run();

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [organizationId, propertyId, reloadSilent]);

  useEffect(() => {
    if (liveMode === 'live') {
      return undefined;
    }
    const timer = window.setInterval(() => reloadSilent(), 15_000);
    return () => window.clearInterval(timer);
  }, [liveMode, reloadSilent]);

  return liveMode;
}
