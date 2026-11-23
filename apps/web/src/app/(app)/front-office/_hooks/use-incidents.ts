'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Incident, IncidentStatus, RoomRackItem, Stay } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { EMPTY_INCIDENT_FORM, type IncidentForm, type IncidentList, type Tenant } from '../_lib/front-office.types';

export function useIncidentList(tenant: Tenant) {
  const [filter, setFilter] = useState<IncidentStatus | ''>('OPEN');
  const incidents = useAsyncData<IncidentList>(
    () =>
      api<IncidentList>(
        `/api/v1/front-office/incidents?limit=100${filter !== '' ? `&status=${filter}` : ''}`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:front-office:incidents:${filter}`,
  );
  return { filter, setFilter, incidents };
}

export function useIncidentCreate({
  tenant,
  reloadAll,
  setBusy,
}: {
  tenant: Tenant;
  reloadAll: () => void;
  setBusy: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [target, setTarget] = useState<Stay | null>(null);
  const [form, setForm] = useState<IncidentForm>(EMPTY_INCIDENT_FORM);

  function open(stay?: Stay, room?: RoomRackItem): void {
    setTarget(stay ?? null);
    setForm({
      ...EMPTY_INCIDENT_FORM,
      scope: stay !== undefined ? 'stay' : room !== undefined ? 'room' : 'none',
      stayId: stay?.id ?? '',
      roomId: room?.id ?? '',
    });
    modal.onOpen();
  }

  function update<K extends keyof IncidentForm>(key: K, value: IncidentForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (form.title.trim().length < 3 || form.description.trim().length < 3) {
      toast({ title: t('frontOffice.incidentForm.invalid'), status: 'warning' });
      return;
    }
    setBusy('incident:create');
    try {
      await api('/api/v1/front-office/incidents', {
        method: 'POST',
        tenant,
        body: {
          type: form.type,
          severity: form.severity,
          title: form.title.trim(),
          description: form.description.trim(),
          ...(form.scope === 'stay' && form.stayId !== '' ? { stayId: form.stayId } : {}),
          ...(form.scope === 'room' && form.roomId !== '' ? { roomId: form.roomId } : {}),
        },
      });
      toast({ title: t('frontOffice.incidentForm.created'), status: 'success' });
      modal.onClose();
      reloadAll();
    } catch (cause) {
      toast({
        title: t('frontOffice.error.generic'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  return { modal, target, form, update, open, submit };
}

export function useIncidentResolve({
  tenant,
  reloadAll,
  setBusy,
}: {
  tenant: Tenant;
  reloadAll: () => void;
  setBusy: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [target, setTarget] = useState<Incident | null>(null);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<unknown>(null);

  function open(incident: Incident): void {
    setTarget(incident);
    setResolution('');
    setError(null);
    modal.onOpen();
  }

  async function confirm(): Promise<void> {
    if (target === null || resolution.trim().length < 3) {
      toast({ title: t('frontOffice.resolve.tooShort'), status: 'warning' });
      return;
    }
    const current = target;
    setBusy(`incident:resolve:${current.id}`);
    setError(null);
    try {
      await api(`/api/v1/front-office/incidents/${current.id}/resolve`, {
        method: 'POST',
        tenant,
        body: { resolution: resolution.trim() },
      });
      toast({ title: t('frontOffice.resolve.done'), status: 'success' });
      modal.onClose();
      reloadAll();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(null);
    }
  }

  return { modal, target, resolution, setResolution, error, open, confirm };
}

export type IncidentListController = ReturnType<typeof useIncidentList>;
export type IncidentCreateController = ReturnType<typeof useIncidentCreate>;
export type IncidentResolveController = ReturnType<typeof useIncidentResolve>;
