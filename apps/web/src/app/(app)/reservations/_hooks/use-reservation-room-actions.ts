'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import type { Tenant } from './use-reservation-list';

export function useReservationRoomActions({
  tenant,
  selectedId,
  onChanged,
}: {
  tenant: Tenant;
  selectedId: string | null;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [assignRoomId, setAssignRoomId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAssign(): Promise<void> {
    if (selectedId === null || assignRoomId === '') {
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}/room-assignment`, {
        method: 'POST',
        tenant,
        body: { roomId: assignRoomId },
      });
      toast({ title: t('reservations.toast.assigned'), status: 'success' });
      setAssignRoomId('');
      onChanged();
    } catch (cause) {
      toast({
        title: t('reservations.toast.assignError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn(reservation: Reservation): Promise<void> {
    setSaving(true);
    try {
      await api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        tenant,
      });
      toast({ title: t('reservations.toast.checkIn'), status: 'success' });
      onChanged();
    } catch (cause) {
      toast({
        title: t('reservations.toast.checkInError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  function reset(): void {
    setAssignRoomId('');
  }

  return {
    assignRoomId,
    setAssignRoomId,
    saving,
    handleAssign,
    handleCheckIn,
    reset,
  };
}

export type ReservationRoomActions = ReturnType<typeof useReservationRoomActions>;
