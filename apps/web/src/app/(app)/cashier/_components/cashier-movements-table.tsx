'use client';

import { Box, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { cashMovementLabel, formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashSession } from '@/lib/types';

export function CashierMovementsTable({ session }: { session: CashSession }) {
  const { t, locale } = useI18n();

  return (
    <Box>
      <Text fontWeight="semibold" fontSize="sm" mb={2}>
        {t('cashier.movements.title')}
      </Text>
      {session.movements.length === 0 ? (
        <Text fontSize="sm" color="textSecondary">
          {t('cashier.movements.empty')}
        </Text>
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('cashier.movements.type')}</Th>
                <Th isNumeric>{t('cashier.movements.amount')}</Th>
                <Th>{t('cashier.movements.description')}</Th>
                <Th>{t('cashier.movements.createdAt')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {session.movements.map((movement) => (
                <Tr key={movement.id}>
                  <Td>{cashMovementLabel(locale, movement.type)}</Td>
                  <Td isNumeric>{formatMoney(movement.amount, movement.currencyCode)}</Td>
                  <Td>
                    <Text fontSize="sm" noOfLines={2}>
                      {movement.description ?? '—'}
                    </Text>
                  </Td>
                  <Td>{formatDateTime(movement.createdAt)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
