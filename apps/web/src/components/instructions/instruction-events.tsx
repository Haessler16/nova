'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { formatDateTime, instructionStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { InstructionEvent } from '@/lib/types';
import { eventLabel } from './instruction-options';

export function InstructionEvents({ events }: { events: InstructionEvent[] }) {
  const { t, locale } = useI18n();

  return (
    <Box mt={3} borderLeftWidth="3px" borderColor="gray.200" pl={3}>
      {events.length === 0 ? (
        <Text fontSize="xs" color="gray.500">
          {t('reservations.detail.historyEmpty')}
        </Text>
      ) : (
        <Stack spacing={1}>
          {events.map((event) => (
            <Text key={event.id} fontSize="xs" color="gray.600">
              {formatDateTime(event.occurredAt)} · {eventLabel(t, event.eventType)}
              {event.fromStatus !== null && event.toStatus !== null
                ? ` (${instructionStatusLabel(locale, event.fromStatus)} → ${instructionStatusLabel(
                    locale,
                    event.toStatus,
                  )})`
                : ''}
              {event.reason !== null ? ` · ${event.reason}` : ''}
            </Text>
          ))}
        </Stack>
      )}
    </Box>
  );
}
