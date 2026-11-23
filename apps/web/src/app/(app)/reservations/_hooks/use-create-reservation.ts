'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { nightsBetween } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Availability, Reservation, RoomType } from '@/lib/types';
import { hasErrors, type FieldErrors } from '@/lib/validation';
import { useAsyncData } from '@/lib/use-async-data';
import { initialCreateForm, type CreateForm } from '../_lib/reservation-forms';
import { createBody, validateCreateForm } from '../_lib/reservation-validation';
import type { Tenant } from './use-reservation-list';

function createDatesValid(form: CreateForm): boolean {
  return (
    form.checkInDate !== '' &&
    form.checkOutDate !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.checkInDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.checkOutDate) &&
    nightsBetween(form.checkInDate, form.checkOutDate) >= 1 &&
    nightsBetween(form.checkInDate, form.checkOutDate) <= 366
  );
}

function useCreateAvailability(
  tenant: Tenant,
  form: CreateForm,
  isOpen: boolean,
  datesValid: boolean,
) {
  return useAsyncData<Availability>(
    async () => {
      if (!isOpen || !datesValid) {
        return { checkInDate: '', checkOutDate: '', nights: 0, items: [] };
      }
      const params = new URLSearchParams({
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
      });
      if (form.roomTypeId !== '') params.set('roomTypeId', form.roomTypeId);
      return api<Availability>(`/api/v1/reservations/availability?${params.toString()}`, {
        tenant,
      });
    },
    `${String(isOpen)}:${form.checkInDate}:${form.checkOutDate}:${form.roomTypeId}`,
  );
}

export function useCreateReservation({
  tenant,
  propertyTimezone,
  onReload,
  onOpenDetail,
}: {
  tenant: Tenant;
  propertyTimezone: string | undefined;
  onReload: () => void;
  onOpenDetail: (reservation: Reservation) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [form, setForm] = useState<CreateForm>(() => initialCreateForm(propertyTimezone));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const datesValid = createDatesValid(form);
  const availability = useCreateAvailability(tenant, form, modal.isOpen, datesValid);

  const lookup = useAsyncData<{ roomTypes: RoomType[] }>(
    async () => {
      if (!modal.isOpen) {
        return { roomTypes: [] };
      }
      const roomTypes = await api<{ items: RoomType[] }>(
        '/api/v1/inventory/room-types?status=ACTIVE',
        { tenant },
      );
      return { roomTypes: roomTypes.items };
    },
    `${tenant.organizationId}:${tenant.propertyId}:room-types:${String(modal.isOpen)}`,
  );

  function open(): void {
    setForm(initialCreateForm(propertyTimezone));
    setErrors({});
    modal.onOpen();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateCreateForm(form, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const created = await api<Reservation>('/api/v1/reservations', {
        method: 'POST',
        tenant,
        body: createBody(form),
      });
      toast({ title: t('reservations.toast.created'), status: 'success' });
      modal.onClose();
      onReload();

      // The structured panel lives in the detail. If the operator pasted an
      // observation at creation time, pre-parse it so suggestions are ready for
      // human confirmation; the parser never changes money or occupancy.
      if (form.notes.trim() !== '') {
        try {
          await api(`/api/v1/reservations/${created.id}/source-notes/parse`, {
            method: 'POST',
            tenant,
            body: { text: form.notes.trim(), sourceSystem: 'RESERVATIONS_FORM' },
          });
          toast({
            title: t('reservations.toast.parsed'),
            description: t('reservations.toast.parsedBody'),
            status: 'info',
            duration: 8000,
          });
        } catch {
          toast({
            title: t('reservations.toast.parseFailed'),
            description: t('reservations.toast.parseFailedBody'),
            status: 'warning',
            duration: 8000,
          });
        }
      }
      onOpenDetail(created);
    } catch (cause) {
      toast({
        title: t('reservations.toast.createError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    modal,
    form,
    setForm,
    errors,
    saving,
    datesValid,
    nights: nightsBetween(form.checkInDate, form.checkOutDate),
    lookup,
    availability,
    open,
    submit,
  };
}

export type CreateReservationController = ReturnType<typeof useCreateReservation>;
