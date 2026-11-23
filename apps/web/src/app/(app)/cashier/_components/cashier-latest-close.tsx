'use client';

import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { StatusBadge } from '@/components/ui';
import {
  OPERATIONAL_CLOSE_COLORS,
  OPERATIONAL_CLOSE_LABELS,
  formatCalendarDate,
  formatMoney,
} from '@/lib/format';
import type { OperationalClose } from '@/lib/types';

export function CashierLatestClose({
  close,
  onReopen,
}: {
  close: OperationalClose;
  onReopen: (target: OperationalClose) => void;
}) {
  return (
    <Box mb={4} p={3} borderWidth="1px" borderColor="line" borderRadius="lg" bg="gray.50">
      <HStack justify="space-between" align="flex-start" spacing={3}>
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            {formatCalendarDate(close.operationalDate)}
          </Text>
          <Text fontSize="xs" color="textSecondary">
            {close.snapshot.forced
              ? 'Cierre forzado con motivo registrado.'
              : 'Cierre sin bloqueos.'}{' '}
            Saldo de folios abiertos:{' '}
            {formatMoney(close.snapshot.totals.openFolioBalance, close.snapshot.currencyCode)}
          </Text>
        </Box>
        <StatusBadge
          color={OPERATIONAL_CLOSE_COLORS[close.status]}
          label={OPERATIONAL_CLOSE_LABELS[close.status]}
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
          Reabrir día
        </Button>
      )}
    </Box>
  );
}
