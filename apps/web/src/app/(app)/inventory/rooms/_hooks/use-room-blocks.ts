'use client';

import { useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { RoomBlock } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import {
  blockFormErrors,
  emptyBlockForm,
  type BlockForm,
} from '../_lib/rooms';

export function useRoomBlocks(selectedRoomId: string | null, reload: () => void, bumpDetail: () => void) {
  const { tenant } = useSession();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<BlockForm>(emptyBlockForm);

  function reset(): void {
    setForm(emptyBlockForm());
    setErrors({});
  }

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    const nextErrors = blockFormErrors(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, {
        method: 'POST',
        tenant,
        body: {
          type: form.type,
          reason: form.reason.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        },
      });
      toast({ title: 'Bloqueo creado', status: 'success' });
      setForm({ ...form, reason: '' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo crear el bloqueo',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function release(block: RoomBlock): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    const reason = window.prompt('Motivo de liberación (opcional)', 'Liberado desde la UI');
    if (reason === null) {
      return;
    }
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks/${block.id}/release`, {
        method: 'POST',
        tenant,
        body: reason.trim() === '' ? {} : { reason: reason.trim() },
      });
      toast({ title: 'Bloqueo liberado', status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({ title: 'No se pudo liberar', description: errorMessage(cause), status: 'error' });
    }
  }

  return { form, setForm, errors, saving, create, release, reset };
}

export type RoomBlocks = ReturnType<typeof useRoomBlocks>;
