'use client';

import { useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { CashSession } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import {
  EMPTY_MOVEMENT_FORM,
  movementFormErrors,
  type MovementForm,
} from '../_lib/cashier-forms';

export function useCashierMovement(session: CashSession | null, onRegistered: () => void) {
  const { tenant } = useSession();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<MovementForm>(EMPTY_MOVEMENT_FORM);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (session === null) {
      return;
    }
    const nextErrors = movementFormErrors(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/cash-sessions/${session.id}/movements`, {
        method: 'POST',
        tenant,
        body: {
          type: form.type,
          amount: form.amount,
          ...(form.description.trim() !== '' ? { description: form.description.trim() } : {}),
          idempotencyKey: `cash-movement-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Movimiento registrado', status: 'success' });
      setForm((current) => ({ ...current, amount: '', description: '' }));
      onRegistered();
    } catch (cause) {
      toast({
        title: 'No se pudo registrar el movimiento',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return { form, setForm, errors, saving, submit };
}

export type CashierMovement = ReturnType<typeof useCashierMovement>;
