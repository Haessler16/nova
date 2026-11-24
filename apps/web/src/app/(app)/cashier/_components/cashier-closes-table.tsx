'use client';

import { Button, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import {
  OPERATIONAL_CLOSE_COLORS,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
  operationalCloseStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { OperationalClose } from '@/lib/types';
import type { CashierData } from '../_hooks/use-cashier-data';

export function CashierClosesTable({
  data,
  onReopen,
}: {
  data: CashierData;
  onReopen: (target: OperationalClose) => void;
}) {
  const { t, locale } = useI18n();
  const { closes } = data;
  const closeItems = closes.data?.items ?? [];

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={3}>
        {t('cashier.closes.title')}
      </Text>
      <QueryFeedback
        loading={closes.loading}
        error={closes.error}
        onRetry={closes.reload}
        isEmpty={closeItems.length === 0}
        emptyText={t('cashier.closes.empty')}
      >
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('cashier.closes.day')}</Th>
                <Th>{t('cashier.closes.status')}</Th>
                <Th>{t('cashier.closes.forced')}</Th>
                <Th isNumeric>{t('cashier.closes.openFolioBalance')}</Th>
                <Th>{t('cashier.closes.closedAt')}</Th>
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
                      label={operationalCloseStatusLabel(locale, close.status)}
                    />
                  </Td>
                  <Td>
                    {close.snapshot.forced ? t('cashier.closes.yes') : t('cashier.closes.no')}
                  </Td>
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
                        {t('cashier.closes.reopen')}
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
