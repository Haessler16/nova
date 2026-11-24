'use client';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import {
  INSTRUCTION_PRIORITY_COLORS,
  formatDateTime,
  guestNotePurposeLabel,
  instructionCategoryLabel,
  instructionPriorityLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
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
  const { t, locale } = useI18n();

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
            label={instructionPriorityLabel(locale, note.priority)}
          />
          <Badge colorScheme="gray">{instructionCategoryLabel(locale, note.category)}</Badge>
          {!note.isActive && (
            <Badge colorScheme="gray" textTransform="none">
              {t('guestNotes.item.inactive')}
            </Badge>
          )}
        </HStack>
        {canManage && (
          <Button size="xs" variant="ghost" isLoading={busy} onClick={() => onToggle(note)}>
            {note.isActive ? t('guestNotes.item.deactivate') : t('guestNotes.item.reactivate')}
          </Button>
        )}
      </HStack>
      <Text fontSize="sm" mt={2} whiteSpace="pre-wrap">
        {note.body}
      </Text>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {note.purpose !== null ? `${guestNotePurposeLabel(locale, note.purpose)} · ` : ''}
        {formatDateTime(note.createdAt)}
        {note.expiresAt !== null
          ? t('guestNotes.item.expires', { date: formatDateTime(note.expiresAt) })
          : ''}
      </Text>
    </Box>
  );
}
