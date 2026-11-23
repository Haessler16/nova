'use client';

import {
  Button,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import {
  OPERATIONAL_CLOSE_COLORS,
  OPERATIONAL_CLOSE_LABELS,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type { OperationalClose } from '@/lib/types';
import type { CashierData } from '../_hooks/use-cashier-data';

export function CashierClosesTable({
  data,
  onReopen,
}: {
  data: CashierData;
  onReopen: (target: OperationalClose) => void;
}) {
  const { closes } = data;
  const closeItems = closes.data?.items ?? [];

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={3}>
        Cierres operativos
      </Text>
      <QueryFeedback
        loading={closes.loading}
        error={closes.error}
        onRetry={closes.reload}
        isEmpty={closeItems.length === 0}
        emptyText="Todavía no hay cierres operativos."
      >
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Día</Th>
                <Th>Estado</Th>
                <Th>Forzado</Th>
                <Th isNumeric>Saldo folios</Th>
                <Th>Cerrado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {closeItems.map((close) => (
                <Tr key={close.id}>
                  <Td>{formatCalendarDate(close.operationalDate)}</Td>
                  <Td>
                    <StatusBadge
                      color={OPERATIONAL_CLOSE_COLORS[close.status]}
                      label={OPERATIONAL_CLOSE_LABELS[close.status]}
                    />
                  </Td>
                  <Td>{close.snapshot.forced ? 'Sí' : 'No'}</Td>
                  <Td isNumeric>
                    {formatMoney(
                      close.snapshot.totals.openFolioBalance,
                      close.snapshot.currencyCode,
                    )}
                  </Td>
                  <Td>{formatDateTime(close.closedAt)}</Td>
                  <Td isNumeric>
                    {close.status === 'CLOSED' && (
                      <Button size="xs" variant="ghost" onClick={() => onReopen(close)}>
                        Reabrir
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </QueryFeedback>
    </SectionCard>
  );
}
