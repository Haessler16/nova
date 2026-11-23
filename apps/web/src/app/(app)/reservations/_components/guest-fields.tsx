'use client';

import { Input, Select, SimpleGrid } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { DOCUMENT_TYPES, documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { GuestDocumentType } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import type { GuestFormState } from '../_lib/reservation-forms';

export function GuestFields({
  value,
  onChange,
  disabled = false,
  idPrefix,
  errors,
}: {
  value: GuestFormState;
  onChange: (patch: Partial<GuestFormState>) => void;
  disabled?: boolean;
  idPrefix: string;
  errors?: FieldErrors;
}) {
  const { t, locale } = useI18n();
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      <Field label={t('reservations.guest.field.fullName')} isRequired error={errors?.fullName}>
        <Input
          id={`${idPrefix}-full-name`}
          value={value.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          placeholder={t('reservations.guest.field.fullNamePlaceholder')}
          isDisabled={disabled}
          maxLength={160}
        />
      </Field>
      <Field label={t('reservations.guest.field.email')} error={errors?.email}>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(event) => onChange({ email: event.target.value })}
          placeholder={t('reservations.guest.field.emailPlaceholder')}
          isDisabled={disabled}
          maxLength={254}
        />
      </Field>
      <Field label={t('reservations.guest.field.phone')} error={errors?.phone}>
        <Input
          id={`${idPrefix}-phone`}
          value={value.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="+55 11 90000-0000"
          isDisabled={disabled}
          maxLength={32}
        />
      </Field>
      <Field label={t('reservations.guest.field.documentType')}>
        <Select
          id={`${idPrefix}-document-type`}
          value={value.documentType}
          onChange={(event) =>
            onChange({ documentType: event.target.value as '' | GuestDocumentType })
          }
          isDisabled={disabled}
        >
          <option value="">{t('reservations.guest.noDocument')}</option>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {documentTypeLabel(locale, type)}
            </option>
          ))}
        </Select>
      </Field>
      {value.documentType !== '' && (
        <Field
          label={t('reservations.guest.field.documentNumber')}
          isRequired
          error={errors?.documentNumber}
        >
          <Input
            id={`${idPrefix}-document-number`}
            value={value.documentNumber}
            onChange={(event) => onChange({ documentNumber: event.target.value })}
            placeholder={t('reservations.guest.field.documentNumberPlaceholder')}
            isDisabled={disabled}
            minLength={3}
            maxLength={64}
          />
        </Field>
      )}
    </SimpleGrid>
  );
}
