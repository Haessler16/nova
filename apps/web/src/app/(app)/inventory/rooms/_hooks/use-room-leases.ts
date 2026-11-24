'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Room, RoomAssignmentLease } from '@/lib/types';

export function useRoomLeases(
  room: Room | null,
  selectedRoomId: string | null,
  reloadSilent: () => void,
  bumpDetail: () => void,
) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceReason, setForceReason] = useState('');

  async function acquire(): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    setBusy(true);
    try {
      await api<RoomAssignmentLease>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases`,
        { method: 'POST', tenant, body: {} },
      );
      toast({ title: t('rooms.lease.toastAcquired'), status: 'success' });
      reloadSilent();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('rooms.lease.toastAcquireError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
      reloadSilent();
    } finally {
      setBusy(false);
    }
  }

  async function renew(): Promise<void> {
    const lease = room?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    setBusy(true);
    try {
      await api<RoomAssignmentLease>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases/${lease.leaseId}/renew`,
        { method: 'POST', tenant },
      );
      toast({ title: t('rooms.lease.toastRenewed'), status: 'success' });
      reloadSilent();
    } catch (cause) {
      toast({
        title: t('rooms.lease.toastRenewError'),
        description: errorMessage(cause),
        status: 'error',
      });
      reloadSilent();
    } finally {
      setBusy(false);
    }
  }

  async function forceRelease(): Promise<void> {
    const lease = room?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    if (forceReason.trim() === '') {
      setForceOpen(true);
      return;
    }
    setBusy(true);
    try {
      await api<{ released: boolean }>(`/api/v1/inventory/rooms/${selectedRoomId}/lease-release`, {
        method: 'POST',
        tenant,
        body: { leaseId: lease.leaseId, reason: forceReason.trim() },
      });
      toast({
        title: t('rooms.lease.toastForceReleased'),
        description: t('rooms.lease.toastForceDescription'),
        status: 'success',
      });
      setForceReason('');
      setForceOpen(false);
      reloadSilent();
    } catch (cause) {
      toast({
        title: t('rooms.lease.toastForceError'),
        description: errorMessage(cause),
        status: 'error',
      });
      reloadSilent();
    } finally {
      setBusy(false);
    }
  }

  async function release(): Promise<void> {
    const lease = room?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    setBusy(true);
    try {
      await api<void>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases/${lease.leaseId}`,
        { method: 'DELETE', tenant },
      );
      toast({ title: t('rooms.lease.toastReleased'), status: 'success' });
      reloadSilent();
    } catch (cause) {
      toast({
        title: t('rooms.lease.toastReleaseError'),
        description: errorMessage(cause),
        status: 'error',
      });
      reloadSilent();
    } finally {
      setBusy(false);
    }
  }

  function cancelForce(): void {
    setForceOpen(false);
    setForceReason('');
  }

  return {
    busy,
    forceOpen,
    setForceOpen,
    forceReason,
    setForceReason,
    acquire,
    renew,
    forceRelease,
    release,
    cancelForce,
  };
}

export type RoomLeases = ReturnType<typeof useRoomLeases>;
