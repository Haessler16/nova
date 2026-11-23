'use client';

import { Badge, Box, HStack, Text } from '@chakra-ui/react';
import { formatLongDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export function HistoricalBanner({ date }: { date: string }) {
  const { t } = useI18n();
  return (
    <HStack
      bg="warning.50"
      borderWidth="1px"
      borderColor="warning.200"
      borderRadius="lg"
      px={4}
      py={3}
      align="flex-start"
      spacing={3}
    >
      <Badge colorScheme="warning" textTransform="none" mt={0.5}>
        {t('frontOffice.historical.badge')}
      </Badge>
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="warning.800">
          {formatLongDate(date)}
        </Text>
        <Text fontSize="xs" color="warning.700">
          {t('frontOffice.historical.note')}
        </Text>
      </Box>
    </HStack>
  );
}
