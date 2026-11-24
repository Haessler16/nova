'use client';

import { Badge, Box, Button, HStack, Stack, Text } from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { blockStatusLabel, blockTypeLabel, formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomBlocks } from '../_hooks/use-room-blocks';
import type { RoomDetail } from '../_hooks/use-room-detail';
import { RoomBlockForm } from './room-block-form';

export function RoomBlocksSection({
  detail,
  blocks,
}: {
  detail: RoomDetail['detail'];
  blocks: RoomBlocks;
}) {
  const { t, locale } = useI18n();

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('rooms.blocks.title')}
      </Text>
      <QueryFeedback
        loading={detail.loading}
        error={detail.error}
        onRetry={detail.reload}
        isEmpty={(detail.data?.blocks.length ?? 0) === 0}
        emptyText={t('rooms.blocks.empty')}
      >
        <Stack spacing={2} mb={4}>
          {detail.data?.blocks.map((block) => (
            <HStack
              key={block.id}
              justify="space-between"
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
              align="flex-start"
            >
              <Box>
                <HStack spacing={2}>
                  <Badge colorScheme={block.type === 'OUT_OF_ORDER' ? 'danger' : 'warning'}>
                    {blockTypeLabel(locale, block.type)}
                  </Badge>
                  <Badge colorScheme={block.status === 'ACTIVE' ? 'mint' : 'gray'}>
                    {blockStatusLabel(locale, block.status)}
                  </Badge>
                </HStack>
                <Text fontSize="sm" mt={1}>
                  {block.reason}
                </Text>
                <Text fontSize="xs" color="textSecondary">
                  {formatDateTime(block.startsAt)} → {formatDateTime(block.endsAt)}
                </Text>
              </Box>
              {block.status === 'ACTIVE' && (
                <Button size="xs" variant="outline" onClick={() => void blocks.release(block)}>
                  {t('rooms.blocks.release')}
                </Button>
              )}
            </HStack>
          ))}
        </Stack>
      </QueryFeedback>

      <RoomBlockForm blocks={blocks} />
    </Box>
  );
}
