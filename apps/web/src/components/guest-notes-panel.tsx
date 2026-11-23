'use client';

import { Box, Button, HStack, Stack, Text, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { GuestNote } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { GuestNoteForm, EMPTY_GUEST_NOTE_DRAFT, type GuestNoteDraft } from './guest-note-form';
import { GuestNoteItem } from './guest-note-item';
import { QueryFeedback, SectionCard } from './ui';

interface GuestNotesPanelProps {
  guestId: string;
  canManage: boolean;
}

export function GuestNotesPanel({ guestId, canManage }: GuestNotesPanelProps) {
  const { tenant } = useSession();
  const toast = useToast();

  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<GuestNoteDraft>(EMPTY_GUEST_NOTE_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notes = useAsyncData<{ items: GuestNote[] }>(
    () =>
      api<{ items: GuestNote[] }>(
        `/api/v1/guests/${guestId}/notes${showInactive ? '?includeInactive=true' : ''}`,
        { tenant },
      ),
    `${guestId}:${String(showInactive)}`,
  );

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (draft.body.trim().length < 2) {
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/guests/${guestId}/notes`, {
        method: 'POST',
        tenant,
        body: {
          category: draft.category,
          priority: draft.priority,
          body: draft.body.trim(),
          purpose: draft.purpose,
          ...(draft.expiresAt !== ''
            ? { expiresAt: new Date(draft.expiresAt).toISOString() }
            : {}),
        },
      });
      setDraft(EMPTY_GUEST_NOTE_DRAFT);
      notes.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo guardar la nota',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(note: GuestNote): Promise<void> {
    setBusyId(note.id);
    try {
      await api(`/api/v1/guests/${guestId}/notes/${note.id}`, {
        method: 'PATCH',
        tenant,
        body: { isActive: !note.isActive },
      });
      notes.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar la nota',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={3} wrap="wrap">
        <Box>
          <Text fontWeight="semibold">Notas persistentes del huésped</Text>
          <Text fontSize="xs" color="gray.500">
            No se copian automáticamente a las reservas.
          </Text>
        </Box>
        <Button size="xs" variant="ghost" onClick={() => setShowInactive((current) => !current)}>
          {showInactive ? 'Ocultar inactivas' : 'Ver inactivas'}
        </Button>
      </HStack>

      <QueryFeedback
        loading={notes.loading}
        error={notes.error}
        onRetry={notes.reload}
        isEmpty={(notes.data?.items.length ?? 0) === 0}
        emptyText="Sin notas registradas."
      >
        <Stack spacing={2}>
          {notes.data?.items.map((note) => (
            <GuestNoteItem
              key={note.id}
              note={note}
              canManage={canManage}
              busy={busyId === note.id}
              onToggle={(target) => void toggleActive(target)}
            />
          ))}
        </Stack>
      </QueryFeedback>

      {canManage && (
        <Box mt={4}>
          <GuestNoteForm
            draft={draft}
            onChange={setDraft}
            saving={saving}
            onSubmit={(event) => void handleCreate(event)}
          />
        </Box>
      )}
    </SectionCard>
  );
}
