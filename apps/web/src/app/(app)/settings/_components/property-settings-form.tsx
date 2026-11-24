'use client';

import { Button, Input, Stack } from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { Field, SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();

  return (
    <SectionCard>
      <form onSubmit={onSubmit}>
        <Stack spacing={4}>
          <Field label={t('settings.field.name')} isRequired>
            <Input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              required
            />
          </Field>
          <Field
            label={t('settings.field.timezone')}
            isRequired
            helper={t('settings.field.timezoneHelper')}
          >
            <Input
              value={form.timezone}
              onChange={(event) => onChange({ ...form, timezone: event.target.value })}
              required
            />
          </Field>
          <Field
            label={t('settings.field.currency')}
            isRequired
            helper={t('settings.field.currencyHelper')}
          >
            <Input
              value={form.currencyCode}
              maxLength={3}
              onChange={(event) =>
                onChange({ ...form, currencyCode: event.target.value.toUpperCase() })
              }
              required
            />
          </Field>
          <Field
            label={t('settings.field.dayStart')}
            isRequired
            helper={t('settings.field.dayStartHelper')}
          >
            <Input
              type="time"
              value={form.operationalDayStart}
              onChange={(event) => onChange({ ...form, operationalDayStart: event.target.value })}
              required
            />
          </Field>
          <Button type="submit" colorScheme="brand" isLoading={saving} alignSelf="flex-start">
            {t('settings.save')}
          </Button>
        </Stack>
      </form>
    </SectionCard>
  );
}
