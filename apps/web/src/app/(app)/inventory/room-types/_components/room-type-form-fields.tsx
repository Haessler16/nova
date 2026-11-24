'use client';

import { HStack, Input, Select, Stack } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { FieldErrors } from '@/lib/validation';
import type { RoomTypeForm } from '../_lib/room-type-form';

export function RoomTypeFormFields({
  form,
  setForm,
  errors,
  editing,
}: {
  form: RoomTypeForm;
  setForm: (form: RoomTypeForm) => void;
  errors: FieldErrors;
  editing: boolean;
}) {
  const { t } = useI18n();

  return (
    <Stack spacing={4}>
      <Field label={t('roomTypes.field.name')} isRequired error={errors.name}>
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          maxLength={120}
        />
      </Field>
      <Field
        label={t('roomTypes.field.code')}
        isRequired
        error={errors.code}
        helper={t('roomTypes.field.codeHelper')}
      >
        <Input
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
          isDisabled={editing}
          required
          maxLength={24}
        />
      </Field>
      <Field label={t('roomTypes.field.description')} error={errors.description}>
        <Input
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          maxLength={500}
        />
      </Field>
      <HStack spacing={4} align="flex-start">
        <Field
          label={t('roomTypes.field.capacityAdults')}
          isRequired
          error={errors.capacityAdults}
        >
          <Input
            type="number"
            min={1}
            max={50}
            value={form.capacityAdults}
            onChange={(event) => setForm({ ...form, capacityAdults: event.target.value })}
            required
          />
        </Field>
        <Field
          label={t('roomTypes.field.capacityChildren')}
          isRequired
          error={errors.capacityChildren}
        >
          <Input
            type="number"
            min={0}
            max={50}
            value={form.capacityChildren}
            onChange={(event) => setForm({ ...form, capacityChildren: event.target.value })}
            required
          />
        </Field>
      </HStack>
      <Field label={t('roomTypes.field.bedType')} error={errors.bedType}>
        <Input
          value={form.bedType}
          onChange={(event) => setForm({ ...form, bedType: event.target.value })}
          maxLength={64}
        />
      </Field>
      {editing && (
        <Field label={t('roomTypes.field.status')}>
          <Select
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as 'ACTIVE' | 'DISABLED' })
            }
          >
            <option value="ACTIVE">{t('roomTypes.status.active')}</option>
            <option value="DISABLED">{t('roomTypes.status.disabled')}</option>
          </Select>
        </Field>
      )}
    </Stack>
  );
}
