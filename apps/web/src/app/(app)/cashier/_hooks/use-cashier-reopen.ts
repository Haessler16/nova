'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { OperationalClose } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import { reopenErrors } from '../_lib/cashier-forms';

export function useCashierReopen(onReopened: () => void) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [target, setTarget] = useState<OperationalClose | null>(null);
  const [reason, setReason] = useState('');

  function open(close: OperationalClose): void {
    setTarget(close);
    setReason('');
    modal.onOpen();
  }

  function close(): void {
    modal.onClose();
    setApiError(null);
  }

  async function submit(): Promise<void> {
    if (target === null) {
      return;
    }
    const nextErrors = reopenErrors(reason, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      await api(`/api/v1/operational-days/${target.id}/reopen`, {
        method: 'POST',
        tenant,
        body: {
          reason,
          idempotencyKey: `night-audit-reopen-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: t('cashier.reopen.toast.ok'), status: 'success' });
      modal.onClose();
      onReopened();
    } catch (cause) {
      const message = errorMessage(cause);
      setApiError(message);
      toast({
        title: t('cashier.reopen.toast.error'),
        description: message,
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    modal,
    target,
    reason,
    setReason,
    errors,
    saving,
    apiError,
    open,
    close,
    submit,
  };
}

export type CashierReopen = ReturnType<typeof useCashierReopen>;
