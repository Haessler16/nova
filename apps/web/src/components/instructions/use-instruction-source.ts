'use client';

import { useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type {
  ParsedInstructionSuggestion,
  ReservationInstruction,
  ReservationSourceNote,
} from '@/lib/types';

export interface ParsedSourceNotes {
  sourceNoteId: string;
  suggestions: ParsedInstructionSuggestion[];
  warnings: string[];
  redacted: boolean;
}

export function useInstructionSource(
  reservationId: string,
  reloadSourceNotes: () => void,
  notifyChanged: () => void,
) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();

  const [showSourceText, setShowSourceText] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parsed, setParsed] = useState<ParsedSourceNotes | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function parse(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (sourceText.trim().length === 0) {
      return;
    }
    setParsing(true);
    try {
      const note = await api<ReservationSourceNote>(
        `/api/v1/reservations/${reservationId}/source-notes/parse`,
        {
          method: 'POST',
          tenant,
          body: { text: sourceText, sourceSystem: 'MANUAL' },
        },
      );
      setParsed({
        sourceNoteId: note.id,
        suggestions: note.suggestions,
        warnings: note.warnings,
        redacted: note.redacted,
      });
      setSelected(new Set(note.suggestions.map((_item, index) => index)));
      setSourceText('');
      reloadSourceNotes();
    } catch (cause) {
      toast({
        title: t('instructions.toast.parseError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setParsing(false);
    }
  }

  async function confirm(): Promise<void> {
    if (parsed === null) {
      return;
    }
    const suggestions = parsed.suggestions.filter((_suggestion, index) => selected.has(index));
    if (suggestions.length === 0) {
      return;
    }
    setConfirming(true);
    try {
      const result = await api<{ created: ReservationInstruction[]; skipped: number }>(
        `/api/v1/reservations/${reservationId}/source-notes/${parsed.sourceNoteId}/confirm`,
        {
          method: 'POST',
          tenant,
          body: { suggestions },
        },
      );
      toast({
        title: t('instructions.toast.confirmed', { count: result.created.length }),
        description:
          result.skipped > 0
            ? t('instructions.toast.skipped', { count: result.skipped })
            : t('instructions.toast.noCharges'),
        status: 'success',
      });
      setParsed(null);
      setSelected(new Set());
      notifyChanged();
    } catch (cause) {
      toast({
        title: t('instructions.toast.confirmError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setConfirming(false);
    }
  }

  function toggleSuggestion(index: number, checked: boolean): void {
    const next = new Set(selected);
    if (checked) {
      next.add(index);
    } else {
      next.delete(index);
    }
    setSelected(next);
  }

  function toggleSourceText(): void {
    setShowSourceText((current) => !current);
  }

  function clearParsed(): void {
    setParsed(null);
  }

  return {
    showSourceText,
    sourceText,
    setSourceText,
    parsing,
    confirming,
    parsed,
    selected,
    parse,
    confirm,
    toggleSuggestion,
    toggleSourceText,
    clearParsed,
  };
}

export type InstructionSource = ReturnType<typeof useInstructionSource>;
