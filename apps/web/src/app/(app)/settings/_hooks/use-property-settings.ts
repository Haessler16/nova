'use client';

import { useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { OperationalDay, PropertyDetail } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

export interface PropertySettingsForm {
  name: string;
  timezone: string;
  currencyCode: string;
  operationalDayStart: string;
}

const EMPTY_FORM: PropertySettingsForm = {
  name: '',
  timezone: '',
  currencyCode: '',
  operationalDayStart: '',
};

export function usePropertySettings() {
  const { tenant, refresh } = useSession();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData<{
    property: PropertyDetail;
    operationalDay: OperationalDay;
  }>(async () => {
    const [property, operationalDay] = await Promise.all([
      api<PropertyDetail>('/api/v1/properties/current', { tenant }),
      api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    ]);
    return { property, operationalDay };
  }, `${tenant.organizationId}:${tenant.propertyId}:settings`);

  const [form, setForm] = useState<PropertySettingsForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data !== null) {
      setForm({
        name: data.property.name,
        timezone: data.property.timezone,
        currencyCode: data.property.currencyCode,
        operationalDayStart: data.property.operationalDayStart,
      });
    }
  }, [data]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await api<PropertyDetail>('/api/v1/properties/current', {
        method: 'PATCH',
        tenant,
        body: {
          name: form.name.trim(),
          timezone: form.timezone.trim(),
          currencyCode: form.currencyCode.trim().toUpperCase(),
          operationalDayStart: form.operationalDayStart.trim(),
        },
      });
      toast({ title: 'Configuración actualizada', status: 'success' });
      reload();
      await refresh();
    } catch (cause) {
      toast({
        title: 'No se pudo guardar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { data, loading, error, reload, form, setForm, saving, handleSubmit };
}
