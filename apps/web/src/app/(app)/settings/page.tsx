'use client';

import { SimpleGrid, Stack } from '@chakra-ui/react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, QueryFeedback } from '@/components/ui';
import { OperationalDayCard } from './_components/operational-day-card';
import { PropertyMetadataCard } from './_components/property-metadata-card';
import { PropertySettingsFormCard } from './_components/property-settings-form';
import { usePropertySettings } from './_hooks/use-property-settings';

function SettingsContent() {
  const settings = usePropertySettings();

  return (
    <>
      <PageHeader
        title="Configuración de la propiedad"
        description="Timezone IANA, moneda, hora de corte del día operativo y datos generales. Requiere property.manage."
      />

      <QueryFeedback loading={settings.loading} error={settings.error} onRetry={settings.reload}>
        {settings.data !== null && (
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
            <PropertySettingsFormCard
              form={settings.form}
              onChange={settings.setForm}
              saving={settings.saving}
              onSubmit={(event) => void settings.handleSubmit(event)}
            />

            <Stack spacing={6}>
              <OperationalDayCard operationalDay={settings.data.operationalDay} />
              <PropertyMetadataCard property={settings.data.property} />
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
