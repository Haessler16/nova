'use client';

import {
  Badge,
  Button,
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
import { folioLineSourceLabel, formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio, FolioLine, FolioProduct } from '@/lib/types';
import type { FolioAction } from '../_lib/use-folio-action';
import { FolioChargeForm } from './folio-charge-form';
import { FolioConsumptionForm } from './folio-consumption-form';

export function FolioChargesPanel({
  folio,
  folioId,
  catalog,
  action,
  onVoid,
}: {
  folio: Folio;
  folioId: string;
  catalog: FolioProduct[];
  action: FolioAction;
  onVoid: (line: FolioLine) => void;
}) {
  const { t, locale } = useI18n();
  const isOpen = folio.status === 'OPEN';

  return (
    <SectionCard>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">{t('folioDetail.charges.title')}</Text>
        <Badge colorScheme="sky">{folio.lines.length}</Badge>
      </HStack>
      {folio.lines.length === 0 ? (
        <Text fontSize="sm" color="textSecondary">
          {t('folioDetail.charges.empty')}
        </Text>
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('folioDetail.charges.concept')}</Th>
                <Th isNumeric>{t('folioDetail.charges.amount')}</Th>
                <Th>{t('folioDetail.charges.status')}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {folio.lines.map((line) => (
                <Tr key={line.id} opacity={line.status === 'VOID' ? 0.6 : 1}>
                  <Td>
                    <Text fontSize="sm">{line.description}</Text>
                    <Text fontSize="xs" color="textSecondary">
                      {folioLineSourceLabel(locale, line.source)} ·{' '}
                      {line.productId === null
                        ? formatDateTime(line.postedAt)
                        : `${line.quantity} × ${formatMoney(line.unitAmount, line.currencyCode)}`}
                    </Text>
                  </Td>
                  <Td isNumeric>{formatMoney(line.amount, line.currencyCode)}</Td>
                  <Td>
                    <StatusBadge
                      color={line.status === 'POSTED' ? 'mint' : 'danger'}
                      label={
                        line.status === 'POSTED'
                          ? t('folioDetail.charges.posted')
                          : t('folioDetail.charges.voided')
                      }
                    />
                  </Td>
                  <Td isNumeric>
                    {isOpen && line.status === 'POSTED' && (
                      <Button size="xs" variant="ghost" onClick={() => onVoid(line)}>
                        {t('folioDetail.charges.void')}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {isOpen && (
        <>
          <Divider my={4} />
          <FolioConsumptionForm folioId={folioId} catalog={catalog} action={action} />

          <Divider my={4} />
          <FolioChargeForm folioId={folioId} currency={folio.currencyCode} action={action} />
        </>
      )}
    </SectionCard>
  );
}
