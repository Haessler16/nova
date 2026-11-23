'use client';

import { Box, Button, Collapse, Stack, Text } from '@chakra-ui/react';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationSourceNote } from '@/lib/types';

export function SourceNotesCollapse({
  notes,
  isOpen,
  onToggle,
}: {
  notes: ReservationSourceNote[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <Box mt={4}>
      <Button size="xs" variant="ghost" onClick={onToggle} aria-expanded={isOpen}>
        {isOpen ? t('instructions.sourceText.hide') : t('instructions.sourceText.show')}
      </Button>
      <Collapse in={isOpen} animateOpacity>
        <Stack spacing={2} mt={2} maxH="220px" overflowY="auto">
          {notes.map((note) => (
            <Box key={note.id} borderLeftWidth="3px" borderColor="gray.200" pl={3}>
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {note.sourceTextOriginal}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {note.parserVersion} · {formatDateTime(note.importedAt)}
                {note.redacted ? ` ${t('instructions.sourceText.redacted')}` : ''}
              </Text>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
