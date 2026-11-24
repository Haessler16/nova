'use client';

import { Button, HStack, Input, Select, Textarea } from '@chakra-ui/react';
import type { FormEvent } from 'react';
import {
  guestNotePurposeLabel,
  instructionCategoryLabel,
  instructionPriorityLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { InstructionCategory, InstructionPriority } from '@/lib/types';
import { Field } from './ui';

export interface GuestNoteDraft {
  category: InstructionCategory;
  priority: InstructionPriority;
  purpose: string;
  expiresAt: string;
  body: string;
}

export const EMPTY_GUEST_NOTE_DRAFT: GuestNoteDraft = {
  category: 'GENERAL',
  priority: 'NORMAL',
  purpose: 'PREFERENCE',
  expiresAt: '',
  body: '',
};

const CATEGORY_OPTIONS: InstructionCategory[] = [
  'GENERAL',
  'MEAL',
  'ROOM',
  'IMPORTANT',
  'EXTRA',
  'CONFIDENTIAL',
];

const PRIORITY_OPTIONS: InstructionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

const PURPOSE_OPTIONS = ['PREFERENCE', 'ALERT', 'ACCESSIBILITY', 'BILLING', 'OTHER'] as const;

export function GuestNoteForm({
  draft,
  onChange,
  saving,
  onSubmit,
}: {
  draft: GuestNoteDraft;
  onChange: (draft: GuestNoteDraft) => void;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <form onSubmit={onSubmit}>
      <Field label={t('guestNotes.form.title')}>
        <Textarea
          rows={2}
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
          placeholder={t('guestNotes.form.placeholder')}
        />
      </Field>
      <HStack mt={2} spacing={2}>
        <Select
          size="sm"
          maxW="180px"
          value={draft.category}
          onChange={(event) =>
            onChange({ ...draft, category: event.target.value as InstructionCategory })
          }
        >
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {instructionCategoryLabel(locale, category)}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          maxW="140px"
          value={draft.priority}
          onChange={(event) =>
            onChange({ ...draft, priority: event.target.value as InstructionPriority })
          }
        >
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {instructionPriorityLabel(locale, priority)}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          colorScheme="brand"
          type="submit"
          isLoading={saving}
          isDisabled={draft.body.trim().length < 2}
        >
          {t('guestNotes.form.save')}
        </Button>
      </HStack>
      <HStack mt={2} spacing={2} align="end" wrap="wrap">
        <Field label={t('guestNotes.form.purpose')}>
          <Select
            size="sm"
            value={draft.purpose}
            onChange={(event) => onChange({ ...draft, purpose: event.target.value })}
          >
            {PURPOSE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {guestNotePurposeLabel(locale, option)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('guestNotes.form.expires')} helper={t('guestNotes.form.expiresHelper')}>
          <Input
            size="sm"
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(event) => onChange({ ...draft, expiresAt: event.target.value })}
          />
        </Field>
      </HStack>
    </form>
  );
}
