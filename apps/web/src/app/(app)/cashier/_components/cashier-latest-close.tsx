'use client';

import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { StatusBadge } from '@/components/ui';
import {
  OPERATIONAL_CLOSE_COLORS,
  formatCalendarDate,
  formatMoney,
  operationalCloseStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { OperationalClose } from '@/lib/types';

export function CashierLatestClose({
  close,
  onReopen,
}: {
  close: OperationalClose;
  onReopen: (target: OperationalClose) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Box mb={4} p={3} borderWidth="1px" borderColor="line" borderRadius="lg" bg="gray.50">
      <HStack justify="space-between" align="flex-start" spacing={3}>
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            {formatCalendarDate(close.operationalDate)}
          </Text>
          <Text fontSize="xs" color="textSecondary">
            {close.snapshot.forced
              ? t('cashier.latestClose.forced')
              : t('cashier.latestClose.clean')}{' '}
            {t('cashier.latestClose.openBalance', {
              amount: formatMoney(
                close.snapshot.totals.openFolioBalance,
                close.snapshot.currencyCode,
              ),
            })}
          </Text>
        </Box>
        <StatusBadge
          color={OPERATIONAL_CLOSE_COLORS[close.status]}
          label={operationalCloseStatusLabel(locale, close.status)}
        />
      </HStack>
      {close.status === 'CLOSED' && (
        <Button
          size="xs"
          variant="outline"
          colorScheme="warning"
          mt={3}
          onClick={() => onReopen(close)}
        >
          {t('cashier.latestClose.reopen')}
        </Button>
      )}
    </Box>
  );
}
