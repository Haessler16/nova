'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import { EMPTY_OPEN_FORM, openFormErrors, type OpenCashForm } from '../_lib/cashier-forms';

export function useCashierOpen(operationalDate: string | undefined, onOpened: () => void) {
  const { tenant } = useSession();
  const { t } = useI18n();
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
      name: current.name === '' ? t('cashier.open.nameDefault', { date }) : current.name,
      operationalDate: current.operationalDate === '' ? date : current.operationalDate,
      openingAmount: current.openingAmount,
    }));
  }, [operationalDate, t]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = openFormErrors(form, t);
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
      toast({ title: t('cashier.open.toast.ok'), status: 'success' });
      onOpened();
    } catch (cause) {
      toast({
        title: t('cashier.open.toast.error'),
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
