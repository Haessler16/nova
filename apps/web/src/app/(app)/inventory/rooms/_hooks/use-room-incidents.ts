'use client';

import { useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { EMPTY_INCIDENT, type IncidentDraft } from '../_lib/rooms';

export function useRoomIncidents(selectedRoomId: string | null) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IncidentDraft>(EMPTY_INCIDENT);

  function reset(): void {
    setForm(EMPTY_INCIDENT);
  }

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    if (form.title.trim().length < 3 || form.description.trim().length < 3) {
      toast({ title: t('rooms.incidents.toastRequired'), status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api('/api/v1/front-office/incidents', {
        method: 'POST',
        tenant,
        body: {
          roomId: selectedRoomId,
          type: form.type,
          severity: form.severity,
          title: form.title.trim(),
          description: form.description.trim(),
        },
      });
      toast({ title: t('rooms.incidents.toastOk'), status: 'success' });
      setForm(EMPTY_INCIDENT);
    } catch (cause) {
      toast({
        title: t('rooms.incidents.toastError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { form, setForm, saving, create, reset };
}

export type RoomIncidents = ReturnType<typeof useRoomIncidents>;
