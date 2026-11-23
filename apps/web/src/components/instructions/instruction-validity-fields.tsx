'use client';

import { HStack, Input } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import { Field } from '../ui';

export function InstructionValidityFields<T extends { validFrom: string; validUntil: string }>({
  form,
  onChange,
}: {
  form: T;
  onChange: (next: T) => void;
}) {
  const { t } = useI18n();

  return (
    <HStack spacing={3} align="start">
      <Field label={t('instructions.form.validFrom')}>
        <Input
          type="datetime-local"
          value={form.validFrom}
          onChange={(event) => onChange({ ...form, validFrom: event.target.value })}
        />
      </Field>
      <Field label={t('instructions.form.validUntil')}>
        <Input
          type="datetime-local"
          value={form.validUntil}
          onChange={(event) => onChange({ ...form, validUntil: event.target.value })}
        />
      </Field>
    </HStack>
  );
}
