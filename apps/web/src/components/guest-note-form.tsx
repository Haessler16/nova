'use client';

import { Button, HStack, Input, Select, Textarea } from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { INSTRUCTION_CATEGORY_LABELS, INSTRUCTION_PRIORITY_LABELS } from '@/lib/format';
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

const PURPOSE_OPTIONS = [
  { value: 'PREFERENCE', label: 'Preferencia' },
  { value: 'ALERT', label: 'Alerta operativa' },
  { value: 'ACCESSIBILITY', label: 'Accesibilidad' },
  { value: 'BILLING', label: 'Facturación' },
  { value: 'OTHER', label: 'Otro' },
];

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
  return (
    <form onSubmit={onSubmit}>
      <Field label="Nueva nota del huésped">
        <Textarea
          rows={2}
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
          placeholder="Preferencia, alerta o información persistente."
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
              {INSTRUCTION_CATEGORY_LABELS[category]}
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
              {INSTRUCTION_PRIORITY_LABELS[priority]}
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
          Guardar
        </Button>
      </HStack>
      <HStack mt={2} spacing={2} align="end" wrap="wrap">
        <Field label="Propósito">
          <Select
            size="sm"
            value={draft.purpose}
            onChange={(event) => onChange({ ...draft, purpose: event.target.value })}
          >
            {PURPOSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Expira"
          helper="Opcional. Se guarda como instante; la interfaz usa la zona horaria del navegador."
        >
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
