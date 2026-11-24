'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CashSession } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import { EMPTY_CLOSE_FORM, closeFormErrors, type CloseCashForm } from '../_lib/cashier-forms';

export function useCashierClose(session: CashSession | null, onClosed: () => void) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<CloseCashForm>(EMPTY_CLOSE_FORM);

  useEffect(() => {
    if (session === null) {
      setForm({ closingAmount: '', varianceReason: '', notes: '' });
      return;
    }
    setForm({
      closingAmount: session.expectedCashAmount,
      varianceReason: '',
      notes: '',
    });
  }, [session]);

  async function submit(): Promise<void> {
    if (session === null) {
      return;
    }
    const nextErrors = closeFormErrors(form, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      await api(`/api/v1/cash-sessions/${session.id}/close`, {
        method: 'POST',
        tenant,
        body: {
          closingAmount: form.closingAmount,
          ...(form.varianceReason.trim() !== ''
            ? { varianceReason: form.varianceReason.trim() }
            : {}),
          ...(form.notes.trim() !== '' ? { notes: form.notes.trim() } : {}),
          idempotencyKey: `cash-close-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: t('cashier.close.toast.ok'), status: 'success' });
      onClosed();
      setForm({ closingAmount: '', varianceReason: '', notes: '' });
    } catch (cause) {
      const message = errorMessage(cause);
      setApiError(message);
      toast({
        title: t('cashier.close.toast.error'),
        description: message,
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return { form, setForm, errors, saving, apiError, submit };
}

export type CashierClose = ReturnType<typeof useCashierClose>;
