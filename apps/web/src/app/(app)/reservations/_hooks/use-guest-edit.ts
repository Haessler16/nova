'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import { hasErrors, validateGuest, type FieldErrors } from '@/lib/validation';
import {
  EMPTY_GUEST_FORM,
  guestFormFrom,
  guestUpdateBody,
  type GuestFormState,
} from '../_lib/reservation-forms';
import { guestFieldLabels, validationCopy } from '../_lib/reservation-labels';
import type { Tenant } from './use-reservation-list';

export function useGuestEdit({
  tenant,
  onSelectedUpdated,
  onSaved,
}: {
  tenant: Tenant;
  onSelectedUpdated: (guest: Guest) => void;
  onSaved: (source: 'create' | 'detail') => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [target, setTarget] = useState<Guest | null>(null);
  const [source, setSource] = useState<'create' | 'detail'>('create');
  const [form, setForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function open(guest: Guest, origin: 'create' | 'detail'): void {
    setTarget(guest);
    setSource(origin);
    setForm(guestFormFrom(guest));
    setErrors({});
    modal.onOpen();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (target === null) {
      return;
    }
    const nextErrors = validateGuest(form, {
      copy: validationCopy(t),
      labels: guestFieldLabels(t),
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const guest = await api<Guest>(`/api/v1/guests/${target.id}`, {
        method: 'PATCH',
        tenant,
        body: guestUpdateBody(form),
      });
      if (source === 'create') {
        onSelectedUpdated(guest);
      }
      toast({ title: t('reservations.toast.guestUpdated'), status: 'success' });
      modal.onClose();
      onSaved(source);
    } catch (cause) {
      toast({
        title: t('reservations.toast.guestUpdateError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, target, form, setForm, errors, saving, open, submit };
}

export type GuestEditController = ReturnType<typeof useGuestEdit>;
