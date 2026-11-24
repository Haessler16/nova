'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSession } from '@/context/session';
import { api, errorMessage, type TenantSelection } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CheckInRoomOption, Reservation } from '@/lib/types';

export function useCheckInLease({
  isOpen,
  reservation,
  tenant,
  onReadinessReload,
}: {
  isOpen: boolean;
  reservation: Reservation | null;
  tenant: TenantSelection;
  onReadinessReload: () => void;
}) {
  const { actor } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const [roomId, setRoomId] = useState('');
  const [lease, setLease] = useState<{ roomId: string; leaseId: string } | null>(null);
  const [roomBusyId, setRoomBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRoomId(reservation?.roomId ?? '');
    setLease(null);
    setRoomBusyId(null);
  }, [isOpen, reservation?.id, reservation?.roomId]);

  async function releaseHeldLease(): Promise<void> {
    if (lease === null) {
      return;
    }
    const current = lease;
    setLease(null);
    try {
      await api<void>(
        `/api/v1/inventory/rooms/${current.roomId}/assignment-leases/${current.leaseId}`,
        { method: 'DELETE', tenant },
      );
    } catch {
      // The key expires by TTL even if the release request cannot reach Redis.
    }
  }

  async function selectRoom(room: CheckInRoomOption): Promise<void> {
    if (room.lease !== null && room.lease.ownerUserId !== actor?.id) {
      toast({
        title: t('checkIn.toast.leaseHeldTitle'),
        description: t('checkIn.toast.leaseHeldHelp', { name: room.lease.ownerDisplayName }),
        status: 'warning',
      });
      onReadinessReload();
      return;
    }
    if (lease?.roomId === room.id) {
      setRoomId(room.id);
      return;
    }

    await releaseHeldLease();
    if (room.lease !== null && room.lease.ownerUserId === actor?.id) {
      setLease({ roomId: room.id, leaseId: room.lease.leaseId });
      setRoomId(room.id);
      return;
    }

    setRoomBusyId(room.id);
    try {
      const acquired = await api<{ leaseId: string }>(
        `/api/v1/inventory/rooms/${room.id}/assignment-leases`,
        {
          method: 'POST',
          tenant,
          body: { reservationId: reservation?.id },
        },
      );
      setLease({ roomId: room.id, leaseId: acquired.leaseId });
      setRoomId(room.id);
    } catch (cause) {
      toast({
        title: t('checkIn.toast.selectError'),
        description: errorMessage(cause),
        status: 'warning',
        duration: 8000,
      });
      onReadinessReload();
    } finally {
      setRoomBusyId(null);
    }
  }

  useEffect(() => {
    if (!isOpen || lease === null) {
      return;
    }
    const timer = window.setInterval(() => {
      void api(`/api/v1/inventory/rooms/${lease.roomId}/assignment-leases/${lease.leaseId}/renew`, {
        method: 'POST',
        tenant,
      }).catch(() => setLease(null));
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [isOpen, lease, tenant]);

  return { actor, roomId, setRoomId, lease, roomBusyId, selectRoom, releaseHeldLease };
}
