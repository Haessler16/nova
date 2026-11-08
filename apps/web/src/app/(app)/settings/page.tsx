'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { Field, KeyValue, PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import type { OperationalDay, PropertyDetail } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

function SettingsContent() {
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

  const [form, setForm] = useState({
    name: '',
    timezone: '',
    currencyCode: '',
    operationalDayStart: '',
  });
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

  return (
    <>
      <PageHeader
        title="Configuración de la propiedad"
        description="Timezone IANA, moneda, hora de corte del día operativo y datos generales. Requiere property.manage."
      />

      <QueryFeedback loading={loading} error={error} onRetry={reload}>
        {data !== null && (
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
            <SectionCard>
              <form onSubmit={(event) => void handleSubmit(event)}>
                <Stack spacing={4}>
                  <Field label="Nombre" isRequired>
                    <Input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Timezone (IANA)" isRequired helper="Ej.: America/Sao_Paulo">
                    <Input
                      value={form.timezone}
                      onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Moneda" isRequired helper="Código ISO de 3 letras">
                    <Input
                      value={form.currencyCode}
                      maxLength={3}
                      onChange={(event) =>
                        setForm({ ...form, currencyCode: event.target.value.toUpperCase() })
                      }
                      required
                    />
                  </Field>
                  <Field
                    label="Inicio del día operativo"
                    isRequired
                    helper="HH:mm. No se asume medianoche."
                  >
                    <Input
                      type="time"
                      value={form.operationalDayStart}
                      onChange={(event) =>
                        setForm({ ...form, operationalDayStart: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Button
                    type="submit"
                    colorScheme="purple"
                    isLoading={saving}
                    alignSelf="flex-start"
                  >
                    Guardar cambios
                  </Button>
                </Stack>
              </form>
            </SectionCard>

            <Stack spacing={6}>
              <SectionCard>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                  Día operativo calculado
                </Text>
                <Stack spacing={2} mt={3}>
                  <KeyValue
                    label="Fecha operativa"
                    value={formatCalendarDate(data.operationalDay.operationalDate)}
                  />
                  <KeyValue
                    label="Fecha local"
                    value={formatCalendarDate(data.operationalDay.localDate)}
                  />
                  <KeyValue label="Hora local" value={data.operationalDay.localTime} />
                  <KeyValue label="Corte" value={data.operationalDay.operationalDayStart} />
                  <KeyValue label="Timezone" value={data.operationalDay.timezone} />
                </Stack>
              </SectionCard>

              <SectionCard>
                <HStack justify="space-between" mb={3}>
                  <Text fontWeight="semibold">Metadatos</Text>
                  <Badge colorScheme={data.property.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {data.property.status}
                  </Badge>
                </HStack>
                <Stack spacing={2}>
                  <KeyValue label="Código" value={data.property.code} />
                  <KeyValue
                    label="Property ID"
                    value={
                      <Box as="code" fontSize="xs">
                        {data.property.id}
                      </Box>
                    }
                  />
                  <KeyValue label="Creada" value={formatDateTime(data.property.createdAt)} />
                  <KeyValue label="Actualizada" value={formatDateTime(data.property.updatedAt)} />
                </Stack>
              </SectionCard>
            </Stack>
          </SimpleGrid>
        )}
      </QueryFeedback>
    </>
  );
}

export default function SettingsPage() {
  return (
    <PropertyGate>
      <SettingsContent />
    </PropertyGate>
  );
}
