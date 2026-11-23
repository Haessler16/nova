'use client';

import { HStack, Select, Textarea } from '@chakra-ui/react';
import {
  instructionCategoryLabel,
  instructionPriorityLabel,
  instructionVisibilityLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type {
  InstructionCategory,
  InstructionPriority,
  InstructionVisibility,
} from '@/lib/types';
import { Field } from '../ui';
import {
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  VISIBILITY_OPTIONS,
  type NewInstructionDraft,
} from './instruction-options';

export function NewInstructionClassification({
  form,
  onChange,
}: {
  form: NewInstructionDraft;
  onChange: (next: NewInstructionDraft) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <HStack spacing={3} align="start">
        <Field label={t('instructions.form.category')}>
          <Select
            value={form.category}
            onChange={(event) =>
              onChange({
                ...form,
                category: event.target.value as InstructionCategory,
              })
            }
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {instructionCategoryLabel(locale, category)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('instructions.form.priority')}>
          <Select
            value={form.priority}
            onChange={(event) =>
              onChange({
                ...form,
                priority: event.target.value as InstructionPriority,
              })
            }
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {instructionPriorityLabel(locale, priority)}
              </option>
            ))}
          </Select>
        </Field>
      </HStack>
      <HStack spacing={3} align="start">
        <Field label={t('instructions.form.visibility')}>
          <Select
            value={form.visibility}
            onChange={(event) =>
              onChange({
                ...form,
                visibility: event.target.value as InstructionVisibility,
              })
            }
          >
            {VISIBILITY_OPTIONS.map((visibility) => (
              <option key={visibility} value={visibility}>
                {instructionVisibilityLabel(locale, visibility)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('instructions.form.department')}>
          <Textarea
            rows={1}
            value={form.assignedDepartment}
            onChange={(event) => onChange({ ...form, assignedDepartment: event.target.value })}
            placeholder="FRONT_DESK"
          />
        </Field>
      </HStack>
    </>
  );
}
