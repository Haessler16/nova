'use client';

import { Input, Textarea } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import { Field } from '../ui';

export function InstructionCoreFields<T extends { title: string; body: string; tags: string }>({
  form,
  onChange,
  tagsPlaceholder,
}: {
  form: T;
  onChange: (next: T) => void;
  tagsPlaceholder?: string;
}) {
  const { t } = useI18n();

  return (
    <>
      <Field label={t('instructions.form.title')} isRequired>
        <Textarea
          rows={1}
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
        />
      </Field>
      <Field label={t('instructions.form.body')} isRequired>
        <Textarea
          rows={3}
          value={form.body}
          onChange={(event) => onChange({ ...form, body: event.target.value })}
        />
      </Field>
      <Field label={t('instructions.form.tags')} helper={t('instructions.form.tagsHelper')}>
        <Input
          value={form.tags}
          onChange={(event) => onChange({ ...form, tags: event.target.value })}
          {...(tagsPlaceholder !== undefined ? { placeholder: tagsPlaceholder } : {})}
        />
      </Field>
    </>
  );
}
