'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { ReservationInstruction } from '@/lib/types';
import {
  EMPTY_EDIT_INSTRUCTION,
  splitTags,
  toDateTimeLocal,
  type EditInstructionDraft,
} from './instruction-options';

export function useInstructionEdit(reservationId: string, notifyChanged: () => void) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();
  const modal = useDisclosure();

  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<ReservationInstruction | null>(null);
  const [form, setForm] = useState<EditInstructionDraft>(EMPTY_EDIT_INSTRUCTION);

  function open(instruction: ReservationInstruction): void {
    setTarget(instruction);
    setForm({
      title: instruction.title,
      body: instruction.body,
      tags: instruction.tags.join(', '),
      priority: instruction.priority,
      visibility: instruction.visibility,
      assignedDepartment: instruction.assignedDepartment ?? '',
      validFrom: toDateTimeLocal(instruction.validFrom),
      validUntil: toDateTimeLocal(instruction.validUntil),
    });
    modal.onOpen();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (target === null) {
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions/${target.id}`, {
        method: 'PATCH',
        tenant,
        body: {
          title: form.title.trim(),
          body: form.body.trim(),
          tags: splitTags(form.tags),
          priority: form.priority,
          visibility: form.visibility,
          assignedDepartment: form.assignedDepartment.trim(),
          ...(form.validFrom !== ''
            ? { validFrom: new Date(form.validFrom).toISOString() }
            : {}),
          ...(form.validUntil !== ''
            ? { validUntil: new Date(form.validUntil).toISOString() }
            : {}),
        },
      });
      modal.onClose();
      setTarget(null);
      notifyChanged();
    } catch (cause) {
      toast({
        title: t('instructions.toast.editError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, form, setForm, saving, open, submit };
}

export type InstructionEdit = ReturnType<typeof useInstructionEdit>;
