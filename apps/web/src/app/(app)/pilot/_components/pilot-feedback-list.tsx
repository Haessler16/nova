'use client';

import { Box, Button, HStack, Stack, Text, useToast } from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { PilotFeedback } from '@/lib/pilot-types';
import { CATEGORY_KEYS, STATUS_META } from '../_lib/pilot-meta';

export function PilotFeedbackList({
  items,
  loading,
  error,
  onRetry,
  onReviewed,
}: {
  items: PilotFeedback[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
  onReviewed: () => void;
}) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  async function handleReview(id: string): Promise<void> {
    try {
      await api<PilotFeedback>(`/api/v1/pilot/feedback/${id}/review`, {
        method: 'PATCH',
        tenant,
      });
      onReviewed();
    } catch (cause) {
      toast({
        title: t('pilot.toast.reviewError'),
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={1}>
        {t('pilot.recent.title')}
      </Text>
      <Text fontSize="sm" color="textSecondary" mb={4}>
        {t('pilot.recent.hint')}
      </Text>
      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        isEmpty={items.length === 0}
        emptyText={t('pilot.recent.empty')}
      >
        <Stack spacing={3}>
          {items.map((item) => (
            <Box key={item.id} borderWidth="1px" borderColor="line" borderRadius="lg" p={4}>
              <HStack justify="space-between" align="flex-start" spacing={3}>
                <Box flex="1" minW={0}>
                  <HStack spacing={2} mb={1} wrap="wrap">
                    <Text fontWeight="semibold" fontSize="sm">
                      {t(CATEGORY_KEYS[item.category])}
                    </Text>
                    <StatusBadge
                      color={STATUS_META[item.status].color}
                      label={t(STATUS_META[item.status].key)}
                    />
                    {item.rating !== null && (
                      <Text fontSize="xs" color="textSecondary">
                        {t('pilot.recent.rating', { rating: item.rating })}
                      </Text>
                    )}
                  </HStack>
                  <Text fontSize="sm">{item.message}</Text>
                  <Text fontSize="xs" color="textSecondary" mt={1}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </Box>
                {item.status === 'OPEN' && (
                  <Button size="xs" variant="outline" onClick={() => void handleReview(item.id)}>
                    {t('pilot.recent.review')}
                  </Button>
                )}
              </HStack>
            </Box>
          ))}
        </Stack>
      </QueryFeedback>
    </SectionCard>
  );
}
