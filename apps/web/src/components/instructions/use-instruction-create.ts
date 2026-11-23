'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  EMPTY_NEW_INSTRUCTION,
  splitTags,
  type NewInstructionDraft,
} from './instruction-options';

export function useInstructionCreate(reservationId: string, notifyChanged: () => void) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();
  const modal = useDisclosure();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewInstructionDraft>(EMPTY_NEW_INSTRUCTION);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions`, {
        method: 'POST',
        tenant,
        body: {
          category: form.category,
          priority: form.priority,
          visibility: form.visibility,
          title: form.title.trim(),
          body: form.body.trim(),
          tags: splitTags(form.tags),
          ...(form.assignedDepartment.trim() !== ''
            ? { assignedDepartment: form.assignedDepartment.trim() }
            : {}),
          ...(form.actionType !== '' ? { actionType: form.actionType } : {}),
          ...(form.executionMoment !== '' ? { executionMoment: form.executionMoment } : {}),
          ...(form.validFrom !== ''
            ? { validFrom: new Date(form.validFrom).toISOString() }
            : {}),
          ...(form.validUntil !== ''
            ? { validUntil: new Date(form.validUntil).toISOString() }
            : {}),
        },
      });
      setForm(EMPTY_NEW_INSTRUCTION);
      modal.onClose();
      notifyChanged();
    } catch (cause) {
      toast({
        title: t('instructions.toast.createError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, form, setForm, saving, submit };
}

export type InstructionCreate = ReturnType<typeof useInstructionCreate>;
