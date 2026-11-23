'use client';

import {
  Box,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { CASH_MOVEMENT_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import type { CashSession } from '@/lib/types';

export function CashierMovementsTable({ session }: { session: CashSession }) {
  return (
    <Box>
      <Text fontWeight="semibold" fontSize="sm" mb={2}>
        Movimientos
      </Text>
      {session.movements.length === 0 ? (
        <Text fontSize="sm" color="textSecondary">
          Sin movimientos registrados.
        </Text>
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Tipo</Th>
                <Th isNumeric>Importe</Th>
                <Th>Detalle</Th>
                <Th>Registrado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {session.movements.map((movement) => (
                <Tr key={movement.id}>
                  <Td>{CASH_MOVEMENT_LABELS[movement.type]}</Td>
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
