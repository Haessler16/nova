'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  Select,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  INSTRUCTION_CATEGORY_LABELS,
  INSTRUCTION_PRIORITY_COLORS,
  INSTRUCTION_PRIORITY_LABELS,
  formatDateTime,
} from '@/lib/format';
import type {
  GuestNote,
  InstructionCategory,
  InstructionPriority,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { Field, QueryFeedback, SectionCard, StatusBadge } from './ui';

interface GuestNotesPanelProps {
  guestId: string;
  canManage: boolean;
}

const CATEGORY_OPTIONS: InstructionCategory[] = [
  'GENERAL',
  'MEAL',
  'ROOM',
  'IMPORTANT',
  'EXTRA',
  'CONFIDENTIAL',
];

const PRIORITY_OPTIONS: InstructionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export function GuestNotesPanel({ guestId, canManage }: GuestNotesPanelProps) {
  const { tenant } = useSession();
  const toast = useToast();

  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({
    category: 'GENERAL' as InstructionCategory,
    priority: 'NORMAL' as InstructionPriority,
    body: '',
  });
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
    if (form.body.trim().length < 2) {
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/guests/${guestId}/notes`, {
        method: 'POST',
        tenant,
        body: {
          category: form.category,
          priority: form.priority,
          body: form.body.trim(),
          purpose: 'NOTE',
        },
      });
      setForm({ category: 'GENERAL', priority: 'NORMAL', body: '' });
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
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setShowInactive((current) => !current)}
        >
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
            <Box
              key={note.id}
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
              p={3}
              opacity={note.isActive ? 1 : 0.6}
            >
              <HStack justify="space-between" align="start" wrap="wrap">
                <HStack wrap="wrap">
                  <StatusBadge
                    color={INSTRUCTION_PRIORITY_COLORS[note.priority]}
                    label={INSTRUCTION_PRIORITY_LABELS[note.priority]}
                  />
                  <Badge colorScheme="gray">{INSTRUCTION_CATEGORY_LABELS[note.category]}</Badge>
                  {!note.isActive && (
                    <Badge colorScheme="gray" textTransform="none">
                      Inactiva
                    </Badge>
                  )}
                </HStack>
                {canManage && (
                  <Button
                    size="xs"
                    variant="ghost"
                    isLoading={busyId === note.id}
                    onClick={() => void toggleActive(note)}
                  >
                    {note.isActive ? 'Desactivar' : 'Reactivar'}
                  </Button>
                )}
              </HStack>
              <Text fontSize="sm" mt={2} whiteSpace="pre-wrap">
                {note.body}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {formatDateTime(note.createdAt)}
                {note.expiresAt !== null ? ` · expira ${formatDateTime(note.expiresAt)}` : ''}
              </Text>
            </Box>
          ))}
        </Stack>
      </QueryFeedback>

      {canManage && (
        <Box as="form" mt={4} onSubmit={(event) => void handleCreate(event)}>
          <Field label="Nueva nota del huésped">
            <Textarea
              rows={2}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="Preferencia, alerta o información persistente."
            />
          </Field>
          <HStack mt={2} spacing={2}>
            <Select
              size="sm"
              maxW="180px"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value as InstructionCategory })
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
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as InstructionPriority })
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
              isDisabled={form.body.trim().length < 2}
            >
              Guardar
            </Button>
          </HStack>
        </Box>
      )}
    </SectionCard>
  );
}
