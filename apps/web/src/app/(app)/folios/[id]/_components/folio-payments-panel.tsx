'use client';

import {
  Badge,
  Divider,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { SectionCard, StatusBadge } from '@/components/ui';
import {
  PAYMENT_STATUS_COLORS,
  folioStatusLabel,
  formatDateTime,
  formatMoney,
  paymentStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio, PaymentStatus } from '@/lib/types';
import type { FolioAction } from '../_lib/use-folio-action';
import { FolioPaymentForm } from './folio-payment-form';

export function FolioPaymentsPanel({
  folio,
  folioId,
  action,
}: {
  folio: Folio;
  folioId: string;
  action: FolioAction;
}) {
  const { t, locale } = useI18n();
  const isOpen = folio.status === 'OPEN';

  return (
    <SectionCard>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">{t('folioDetail.payments.title')}</Text>
        <Badge colorScheme="mint">{folio.payments.length}</Badge>
      </HStack>
      {folio.payments.length === 0 ? (
        <Text fontSize="sm" color="textSecondary">
          {t('folioDetail.payments.empty')}
        </Text>
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('folioDetail.payments.method')}</Th>
                <Th isNumeric>{t('folioDetail.payments.amount')}</Th>
                <Th>{t('folioDetail.payments.status')}</Th>
                <Th>{t('folioDetail.payments.received')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {folio.payments.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <Text fontSize="sm">{item.method}</Text>
                    {item.referenceId !== null && (
                      <Text fontSize="xs" color="textSecondary">
                        {t('folioDetail.payments.reference', { id: item.referenceId })}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>{formatMoney(item.amount, item.currencyCode)}</Td>
                  <Td>
                    <StatusBadge
                      color={PAYMENT_STATUS_COLORS[item.status as PaymentStatus]}
                      label={paymentStatusLabel(locale, item.status as PaymentStatus)}
                    />
                  </Td>
                  <Td>{formatDateTime(item.receivedAt)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {isOpen && (
        <>
          <Divider my={4} />
          <FolioPaymentForm folioId={folioId} currency={folio.currencyCode} action={action} />
        </>
      )}

      {!isOpen && (
        <Text fontSize="xs" color="textSecondary" mt={4}>
          {t('folioDetail.payments.closed', {
            status: folioStatusLabel(locale, folio.status).toLowerCase(),
          })}
        </Text>
      )}
    </SectionCard>
  );
}
