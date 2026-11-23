'use client';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import {
  INSTRUCTION_CATEGORY_LABELS,
  INSTRUCTION_PRIORITY_COLORS,
  INSTRUCTION_PRIORITY_LABELS,
  formatDateTime,
} from '@/lib/format';
import type { GuestNote } from '@/lib/types';
import { StatusBadge } from './ui';

export function GuestNoteItem({
  note,
  canManage,
  busy,
  onToggle,
}: {
  note: GuestNote;
  canManage: boolean;
  busy: boolean;
  onToggle: (note: GuestNote) => void;
}) {
  return (
    <Box
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
            isLoading={busy}
            onClick={() => onToggle(note)}
          >
            {note.isActive ? 'Desactivar' : 'Reactivar'}
          </Button>
        )}
      </HStack>
      <Text fontSize="sm" mt={2} whiteSpace="pre-wrap">
        {note.body}
      </Text>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {note.purpose !== null ? `${note.purpose} · ` : ''}
        {formatDateTime(note.createdAt)}
        {note.expiresAt !== null ? ` · expira ${formatDateTime(note.expiresAt)}` : ''}
      </Text>
    </Box>
  );
}
