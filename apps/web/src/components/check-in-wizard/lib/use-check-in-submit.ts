'use client';

import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { api, errorMessage, type TenantSelection } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CheckInRoomOption, Reservation, ReservationInstruction } from '@/lib/types';

export function useCheckInActions({
  reservation,
  tenant,
  step,
  setStep,
  selectedRoom,
  windowBlocked,
  windowMessage,
  bumpVersion,
  releaseHeldLease,
  onReadinessReload,
  onInstructionsReload,
  onCompleted,
  onClose,
}: {
  reservation: Reservation | null;
  tenant: TenantSelection;
  step: number;
  setStep: (updater: (current: number) => number) => void;
  selectedRoom: CheckInRoomOption | null;
  windowBlocked: boolean;
  windowMessage: string | null;
  bumpVersion: () => void;
  releaseHeldLease: () => Promise<void>;
  onReadinessReload: () => void;
  onInstructionsReload: () => void;
  onCompleted: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [instructionBusyId, setInstructionBusyId] = useState<string | null>(null);

  async function acknowledgeInstruction(instruction: ReservationInstruction): Promise<void> {
    if (reservation === null) {
      return;
    }
    setInstructionBusyId(instruction.id);
    try {
      await api(
        `/api/v1/reservations/${reservation.id}/instructions/${instruction.id}/acknowledge`,
        { method: 'POST', tenant, body: {} },
      );
      onInstructionsReload();
      toast({ title: t('checkIn.toast.ackOk'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('checkIn.toast.ackError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setInstructionBusyId(null);
    }
  }

  function warnWindowBlocked(): boolean {
    if (!windowBlocked) {
      return false;
    }
    toast({
      title: t('checkIn.toast.windowBlocked'),
      description: windowMessage ?? undefined,
      status: 'warning',
    });
    return true;
  }

  async function handleContinue(): Promise<void> {
    if (reservation === null || warnWindowBlocked()) {
      return;
    }
    if (step === 1) {
      if (selectedRoom === null || !selectedRoom.eligible) {
        toast({ title: t('checkIn.toast.roomRequired'), status: 'warning' });
        return;
      }
      setBusy('assign-room');
      try {
        await api(`/api/v1/reservations/${reservation.id}/room-assignment`, {
          method: 'POST',
          tenant,
          body: { roomId: selectedRoom.id },
        });
        toast({
          title: t('checkIn.toast.roomAssigned', { number: selectedRoom.number }),
          status: 'success',
        });
        bumpVersion();
        await releaseHeldLease();
      } catch (cause) {
        toast({
          title: t('checkIn.toast.assignError'),
          description: errorMessage(cause),
          status: 'error',
          duration: 8000,
        });
        onReadinessReload();
        return;
      } finally {
        setBusy(null);
      }
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function handleConfirm(): Promise<void> {
    if (reservation === null || warnWindowBlocked()) {
      return;
    }
    setBusy('check-in');
    try {
      await api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        tenant,
      });
      toast({
        title: t('checkIn.toast.confirmed', { name: reservation.guest.fullName }),
        status: 'success',
      });
      await releaseHeldLease();
      onCompleted();
      onClose();
    } catch (cause) {
      // The backend revalidated the room and the party inside its transaction.
      // Keep the wizard open and refresh so the operator sees the new state.
      toast({
        title: t('checkIn.toast.confirmError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 10000,
      });
      bumpVersion();
      onInstructionsReload();
    } finally {
      setBusy(null);
    }
  }

  return { busy, instructionBusyId, acknowledgeInstruction, handleContinue, handleConfirm };
}
