'use client';

import { HStack, Input, Select, Stack, Textarea } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FieldErrors } from '@/lib/validation';
import type { GuestForm } from '../_lib/guest-form';

export function GuestFormFields({
  form,
  setForm,
  errors,
}: {
  form: GuestForm;
  setForm: (form: GuestForm) => void;
  errors: FieldErrors;
}) {
  const { t, locale } = useI18n();

  return (
    <Stack spacing={4}>
      <Field label={t('guests.field.fullName')} isRequired error={errors.fullName}>
        <Input
          value={form.fullName}
          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          required
          minLength={2}
          maxLength={160}
        />
      </Field>
      <HStack spacing={4} align="flex-start">
        <Field label={t('guests.field.email')} error={errors.email}>
          <Input
            type="email"
            value={form.email}
            maxLength={254}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field label={t('guests.field.phone')} error={errors.phone}>
          <Input
            value={form.phone}
            maxLength={32}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
      </HStack>
      <HStack spacing={4} align="flex-start">
        <Field label={t('guests.field.documentType')}>
          <Select
            value={form.documentType}
            onChange={(event) =>
              setForm({ ...form, documentType: event.target.value as GuestForm['documentType'] })
            }
          >
            <option value="">{t('guests.noDocument')}</option>
            <option value="PASSPORT">{documentTypeLabel(locale, 'PASSPORT')}</option>
            <option value="NATIONAL_ID">{documentTypeLabel(locale, 'NATIONAL_ID')}</option>
            <option value="DRIVER_LICENSE">{documentTypeLabel(locale, 'DRIVER_LICENSE')}</option>
            <option value="OTHER">{documentTypeLabel(locale, 'OTHER')}</option>
          </Select>
        </Field>
        <Field label={t('guests.field.documentNumber')} error={errors.documentNumber}>
          <Input
            value={form.documentNumber}
            onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
            isDisabled={form.documentType === ''}
            required={form.documentType !== ''}
            minLength={3}
            maxLength={64}
          />
        </Field>
      </HStack>
      <Field
        label={t('guests.field.notes')}
        error={errors.notes}
        helper={t('guests.field.notesHelper')}
      >
        <Textarea
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          maxLength={2000}
          rows={3}
        />
      </Field>
    </Stack>
  );
}
