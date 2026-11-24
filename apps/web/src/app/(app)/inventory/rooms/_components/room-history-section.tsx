'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomDetail } from '../_hooks/use-room-detail';

export function RoomHistorySection({ detail }: { detail: RoomDetail['detail'] }) {
  const { t } = useI18n();

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('rooms.history.title')}
      </Text>
      <QueryFeedback
        loading={detail.loading}
        error={detail.error}
        onRetry={detail.reload}
        isEmpty={(detail.data?.history.length ?? 0) === 0}
        emptyText={t('rooms.history.empty')}
      >
        <Stack spacing={2} maxH="320px" overflowY="auto">
          {detail.data?.history.map((entry) => (
            <Box key={entry.id} borderLeftWidth="3px" borderColor="brand.200" pl={3}>
              <Text fontSize="xs" color="textSecondary">
                {formatDateTime(entry.occurredAt)} · {entry.category}
                {entry.actorName !== null ? ` · ${entry.actorName}` : ''}
              </Text>
              <Text fontSize="sm">
                {entry.fromState ?? '—'} → <strong>{entry.toState}</strong>
              </Text>
              {entry.reason !== null && (
                <Text fontSize="xs" color="textSecondary">
                  {entry.reason}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      </QueryFeedback>
    </Box>
  );
}
