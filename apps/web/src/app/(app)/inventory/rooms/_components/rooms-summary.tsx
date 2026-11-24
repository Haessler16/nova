'use client';

import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { RoomListSummary } from '@/lib/types';

export function RoomsSummary({ summary }: { summary: RoomListSummary | undefined }) {
  const { t } = useI18n();
  const summaryCards = [
    { label: t('rooms.summary.vacant'), value: summary?.vacant ?? 0, color: 'mint.600' },
    { label: t('rooms.summary.occupied'), value: summary?.occupied ?? 0, color: 'brand.600' },
    { label: t('rooms.summary.clean'), value: summary?.clean ?? 0, color: 'sky.600' },
    { label: t('rooms.summary.dirty'), value: summary?.dirty ?? 0, color: 'danger.500' },
    { label: t('rooms.summary.cleaning'), value: summary?.cleaning ?? 0, color: 'warning.500' },
    { label: t('rooms.summary.inspected'), value: summary?.inspected ?? 0, color: 'mint.600' },
    { label: t('rooms.summary.outOfOrder'), value: summary?.outOfOrder ?? 0, color: 'danger.500' },
    {
      label: t('rooms.summary.outOfService'),
      value: summary?.outOfService ?? 0,
      color: 'warning.500',
    },
  ];

  return (
    <>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
        {summaryCards.map((card) => (
          <Box key={card.label} borderWidth="1px" borderRadius="md" px={3} py={2}>
            <Text fontSize="xs" color="textSecondary">
              {card.label}
            </Text>
            <Text fontSize="xl" fontWeight="semibold" color={card.color}>
              {card.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
      <Text fontSize="xs" color="textSecondary" mb={3}>
        {t('rooms.summary.note', { count: summary?.totalRooms ?? 0 })}
      </Text>
    </>
  );
}
