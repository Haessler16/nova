'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { MetricCard, StatusBadge } from '@/components/ui';
import { FOLIO_STATUS_COLORS, folioStatusLabel, formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio } from '@/lib/types';

export function FolioMetrics({ folio }: { folio: Folio }) {
  const { t, locale } = useI18n();

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
      <MetricCard
        label={t('folioDetail.metric.charges')}
        value={formatMoney(folio.totals.charges, folio.currencyCode)}
        accent="sky"
      />
      <MetricCard
        label={t('folioDetail.metric.payments')}
        value={formatMoney(folio.totals.payments, folio.currencyCode)}
        accent="mint"
      />
      <MetricCard
        label={t('folioDetail.metric.balance')}
        value={formatMoney(folio.totals.balance, folio.currencyCode)}
        accent={folio.totals.balance === '0.00' ? 'mint' : 'warning'}
      />
      <MetricCard
        label={t('folioDetail.metric.status')}
        value={
          <StatusBadge
            color={FOLIO_STATUS_COLORS[folio.status]}
            label={folioStatusLabel(locale, folio.status)}
          />
        }
        hint={t('folioDetail.metric.opened', { date: formatDateTime(folio.createdAt) })}
        accent="brand"
      />
    </SimpleGrid>
  );
}
