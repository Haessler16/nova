'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import {
  EMPTY_OPEN_FORM,
  openFormErrors,
  type OpenCashForm,
} from '../_lib/cashier-forms';

export function useCashierOpen(operationalDate: string | undefined, onOpened: () => void) {
  const { tenant } = useSession();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<OpenCashForm>(EMPTY_OPEN_FORM);

  useEffect(() => {
    const date = operationalDate;
    if (date === undefined) {
      return;
    }
    setForm((current) => ({
      name: current.name === '' ? `Caja ${date}` : current.name,
      operationalDate: current.operationalDate === '' ? date : current.operationalDate,
      openingAmount: current.openingAmount,
    }));
  }, [operationalDate]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = openFormErrors(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api('/api/v1/cash-sessions', {
        method: 'POST',
        tenant,
        body: {
          name: form.name,
          operationalDate: form.operationalDate,
          openingAmount: form.openingAmount,
          idempotencyKey: `cash-open-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Caja abierta', status: 'success' });
      onOpened();
    } catch (cause) {
      toast({
        title: 'No se pudo abrir la caja',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return { form, setForm, errors, saving, submit };
}

export type CashierOpen = ReturnType<typeof useCashierOpen>;
