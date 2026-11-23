'use client';

import { Button, Input, Stack } from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { Field, SectionCard } from '@/components/ui';
import type { PropertySettingsForm } from '../_hooks/use-property-settings';

export function PropertySettingsFormCard({
  form,
  onChange,
  saving,
  onSubmit,
}: {
  form: PropertySettingsForm;
  onChange: (form: PropertySettingsForm) => void;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <SectionCard>
      <form onSubmit={onSubmit}>
        <Stack spacing={4}>
          <Field label="Nombre" isRequired>
            <Input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Timezone (IANA)" isRequired helper="Ej.: America/Sao_Paulo">
            <Input
              value={form.timezone}
              onChange={(event) => onChange({ ...form, timezone: event.target.value })}
              required
            />
          </Field>
          <Field label="Moneda" isRequired helper="Código ISO de 3 letras">
            <Input
              value={form.currencyCode}
              maxLength={3}
              onChange={(event) =>
                onChange({ ...form, currencyCode: event.target.value.toUpperCase() })
              }
              required
            />
          </Field>
          <Field label="Inicio del día operativo" isRequired helper="HH:mm. No se asume medianoche.">
            <Input
              type="time"
              value={form.operationalDayStart}
              onChange={(event) =>
                onChange({ ...form, operationalDayStart: event.target.value })
              }
              required
            />
          </Field>
          <Button type="submit" colorScheme="brand" isLoading={saving} alignSelf="flex-start">
            Guardar cambios
          </Button>
        </Stack>
      </form>
    </SectionCard>
  );
}
