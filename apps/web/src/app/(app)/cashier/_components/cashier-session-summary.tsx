'use client';

import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashSession } from '@/lib/types';

export function CashierSessionSummary({ session, cup }: { session: CashSession; cup: string }) {
  const { t } = useI18n();

  return (
    <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
      <Box>
        <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
          {t('cashier.session.opening')}
        </Text>
        <Text fontSize="sm" fontWeight="semibold">
          {formatMoney(session.openingAmount, cup)}
        </Text>
      </Box>
      <Box>
        <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
          {t('cashier.session.expected')}
        </Text>
        <Text fontSize="sm" fontWeight="semibold">
          {formatMoney(session.expectedCashAmount, cup)}
        </Text>
      </Box>
      <Box>
        <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
          {t('cashier.session.openedAt')}
        </Text>
        <Text fontSize="sm" fontWeight="semibold">
          {formatDateTime(session.openedAt)}
        </Text>
      </Box>
    </SimpleGrid>
  );
}
