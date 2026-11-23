'use client';

import { HStack, Select } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { InstructionActionType, InstructionExecutionMoment } from '@/lib/types';
import { instructionActionLabel, instructionMomentLabel } from '@/lib/format';
import { Field } from '../ui';
import {
  ACTION_OPTIONS,
  MOMENT_OPTIONS,
  type NewInstructionDraft,
} from './instruction-options';
import { InstructionValidityFields } from './instruction-validity-fields';
import { NewInstructionClassification } from './new-instruction-classification';

export function NewInstructionFields({
  form,
  onChange,
}: {
  form: NewInstructionDraft;
  onChange: (next: NewInstructionDraft) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <NewInstructionClassification form={form} onChange={onChange} />
      <HStack spacing={3} align="start">
        <Field label={t('instructions.form.action')}>
          <Select
            value={form.actionType}
            onChange={(event) =>
              onChange({
                ...form,
                actionType: event.target.value as '' | InstructionActionType,
              })
            }
          >
            <option value="">{t('instructions.form.infoOnly')}</option>
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {instructionActionLabel(locale, action)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('instructions.form.moment')}>
          <Select
            value={form.executionMoment}
            onChange={(event) =>
              onChange({
                ...form,
                executionMoment: event.target.value as '' | InstructionExecutionMoment,
              })
            }
          >
            <option value="">{t('instructions.form.noMoment')}</option>
            {MOMENT_OPTIONS.map((moment) => (
              <option key={moment} value={moment}>
                {instructionMomentLabel(locale, moment)}
              </option>
            ))}
          </Select>
        </Field>
      </HStack>
      <InstructionValidityFields form={form} onChange={onChange} />
    </>
  );
}
