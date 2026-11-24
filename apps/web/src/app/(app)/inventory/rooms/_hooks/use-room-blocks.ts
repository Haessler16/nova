'use client';

import { useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { RoomBlock } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors } from '@/lib/validation';
import { blockFormErrors, emptyBlockForm, type BlockForm } from '../_lib/rooms';

export function useRoomBlocks(
  selectedRoomId: string | null,
  reload: () => void,
  bumpDetail: () => void,
) {
  const { tenant } = useSession();
  const { t } = useI18n();
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
    const nextErrors = blockFormErrors(form, t);
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
      toast({ title: t('rooms.blocks.toastOk'), status: 'success' });
      setForm({ ...form, reason: '' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('rooms.blocks.toastError'),
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
    const reason = window.prompt(
      t('rooms.blocks.releasePrompt'),
      t('rooms.blocks.releaseDefaultReason'),
    );
    if (reason === null) {
      return;
    }
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks/${block.id}/release`, {
        method: 'POST',
        tenant,
        body: reason.trim() === '' ? {} : { reason: reason.trim() },
      });
      toast({ title: t('rooms.blocks.toastReleased'), status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('rooms.blocks.toastReleaseError'),
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  return { form, setForm, errors, saving, create, release, reset };
}

export type RoomBlocks = ReturnType<typeof useRoomBlocks>;
