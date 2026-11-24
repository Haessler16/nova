'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage, isApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { NightAuditBlocker } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import { EMPTY_AUDIT_FORM, auditFormErrors, type AuditForm } from '../_lib/cashier-forms';

export function useCashierAudit(operationalDate: string | undefined, onClosed: () => void) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [blockers, setBlockers] = useState<NightAuditBlocker[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<AuditForm>(EMPTY_AUDIT_FORM);

  useEffect(() => {
    const date = operationalDate;
    if (date === undefined) {
      return;
    }
    setForm((current) => ({
      ...current,
      operationalDate: current.operationalDate === '' ? date : current.operationalDate,
    }));
  }, [operationalDate]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = auditFormErrors(form, t);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    setBlockers([]);
    try {
      await api('/api/v1/operational-days/close', {
        method: 'POST',
        tenant,
        body: {
          operationalDate: form.operationalDate,
          force: form.force,
          ...(form.forceReason.trim() !== '' ? { forceReason: form.forceReason.trim() } : {}),
          ...(form.notes.trim() !== '' ? { notes: form.notes.trim() } : {}),
          idempotencyKey: `night-audit-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: t('cashier.audit.toast.ok'), status: 'success' });
      setForm((current) => ({
        ...current,
        force: false,
        forceReason: '',
        notes: '',
      }));
      onClosed();
    } catch (cause) {
      if (isApiError(cause) && cause.code === 'night_audit_blocked') {
        const details = cause.details as { blockers?: NightAuditBlocker[] } | undefined;
        setBlockers(details?.blockers ?? []);
        toast({
          title: t('cashier.audit.toast.blocked'),
          description: t('cashier.audit.toast.blockedDescription'),
          status: 'warning',
        });
      } else {
        toast({
          title: t('cashier.audit.toast.error'),
          description: errorMessage(cause),
          status: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return { form, setForm, errors, saving, blockers, submit };
}

export type CashierAudit = ReturnType<typeof useCashierAudit>;
