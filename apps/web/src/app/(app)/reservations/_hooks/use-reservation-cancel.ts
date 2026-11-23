'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { hasErrors, type FieldErrors } from '@/lib/validation';
import { validateCancelReason } from '../_lib/reservation-validation';
import type { Tenant } from './use-reservation-list';

export function useReservationCancel({
  selectedId,
  onSelect,
  onCancelled,
}: {
  selectedId: string | null;
  onSelect: (reservation: Reservation) => void;
  onCancelled: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function open(reservation: Reservation): void {
    onSelect(reservation);
    setReason('');
    setErrors({});
    setApiError(null);
    modal.onOpen();
  }

  function close(): void {
    modal.onClose();
    setApiError(null);
  }

  async function submit(): Promise<void> {
    if (selectedId === null) {
      return;
    }
    const nextErrors = validateCancelReason(reason.trim(), t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      // Cancellation is authorized by the session cookie; the API resolves the
      // tenant from it, so no tenant override is sent here.
      await api<Reservation>(`/api/v1/reservations/${selectedId}/cancel`, {
        method: 'POST',
      });
      toast({ title: t('reservations.toast.cancelled'), status: 'success' });
      modal.onClose();
      setReason('');
      onCancelled();
    } catch (cause) {
      const message = errorMessage(cause);
      setApiError(message);
      toast({
        title: t('reservations.toast.cancelError'),
        description: message,
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    modal,
    open,
    close,
    reason,
    setReason,
    errors,
    saving,
    apiError,
    submit,
  };
}

export type ReservationCancelController = ReturnType<typeof useReservationCancel>;
