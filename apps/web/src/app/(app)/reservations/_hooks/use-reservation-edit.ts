'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { hasErrors, type FieldErrors } from '@/lib/validation';
import type { EditForm } from '../_lib/reservation-forms';
import { editBody, validateEditForm } from '../_lib/reservation-validation';
import type { Tenant } from './use-reservation-list';

export function useReservationEdit({
  tenant,
  selectedId,
  onSelect,
  onSaved,
}: {
  tenant: Tenant;
  selectedId: string | null;
  onSelect: (reservation: Reservation) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [form, setForm] = useState<EditForm>({
    checkInDate: '',
    checkOutDate: '',
    adults: '1',
    children: '0',
    notes: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function open(reservation: Reservation): void {
    onSelect(reservation);
    setForm({
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      adults: String(reservation.adults),
      children: String(reservation.children),
      notes: reservation.notes ?? '',
    });
    setErrors({});
    modal.onOpen();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedId === null) {
      return;
    }
    const nextErrors = validateEditForm(form, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}`, {
        method: 'PATCH',
        tenant,
        body: editBody(form),
      });
      toast({ title: t('reservations.toast.updated'), status: 'success' });
      modal.onClose();
      onSaved();
    } catch (cause) {
      toast({
        title: t('reservations.toast.updateError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, form, setForm, errors, saving, open, submit };
}

export type ReservationEditController = ReturnType<typeof useReservationEdit>;
