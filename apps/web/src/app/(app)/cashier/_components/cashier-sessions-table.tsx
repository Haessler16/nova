'use client';

import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import {
  CASH_SESSION_STATUS_COLORS,
  cashSessionStatusLabel,
  formatCalendarDate,
  formatMoney,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashierData } from '../_hooks/use-cashier-data';

export function CashierSessionsTable({ data }: { data: CashierData }) {
  const { t, locale } = useI18n();
  const { sessions } = data;
  const sessionItems = sessions.data?.items ?? [];

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={3}>
        {t('cashier.sessions.title')}
      </Text>
      <QueryFeedback
        loading={sessions.loading}
        error={sessions.error}
        onRetry={sessions.reload}
        isEmpty={sessionItems.length === 0}
        emptyText={t('cashier.sessions.empty')}
      >
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('cashier.sessions.day')}</Th>
                <Th>{t('cashier.sessions.name')}</Th>
                <Th isNumeric>{t('cashier.sessions.opening')}</Th>
                <Th isNumeric>{t('cashier.sessions.closing')}</Th>
                <Th isNumeric>{t('cashier.sessions.variance')}</Th>
                <Th>{t('cashier.sessions.status')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sessionItems.map((session) => (
                <Tr key={session.id}>
                  <Td>{formatCalendarDate(session.operationalDate)}</Td>
                  <Td>
                    <Text fontSize="sm" noOfLines={1}>
                      {session.name}
                    </Text>
                  </Td>
                  <Td isNumeric>{formatMoney(session.openingAmount, session.currencyCode)}</Td>
                  <Td isNumeric>
                    {session.closingAmount === null
                      ? '—'
                      : formatMoney(session.closingAmount, session.currencyCode)}
                  </Td>
                  <Td isNumeric>
                    {session.status === 'CLOSED'
                      ? formatMoney(session.variance, session.currencyCode)
                      : '—'}
                  </Td>
                  <Td>
                    <StatusBadge
                      color={CASH_SESSION_STATUS_COLORS[session.status]}
                      label={cashSessionStatusLabel(locale, session.status)}
                    />
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
