'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { MetricCard, StatusBadge } from '@/components/ui';
import {
  CASH_SESSION_STATUS_COLORS,
  OPERATIONAL_CLOSE_COLORS,
  cashSessionStatusLabel,
  formatCalendarDate,
  formatMoney,
  operationalCloseStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashierData } from '../_hooks/use-cashier-data';

export function CashierMetrics({ data }: { data: CashierData }) {
  const { t, locale } = useI18n();
  const { operationalDay, sessions, closes, openSession, latestClose, cup } = data;

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={5}>
      <MetricCard
        label={t('cashier.metrics.operationalDay')}
        value={operationalDay.data?.operationalDate ?? '—'}
        hint={
          operationalDay.data === null
            ? undefined
            : `${operationalDay.data.localTime} · ${operationalDay.data.timezone}`
        }
        accent="brand"
        loading={operationalDay.loading}
      />
      <MetricCard
        label={t('cashier.metrics.cash')}
        value={
          openSession === null ? (
            <StatusBadge color="warning" label={t('cashier.metrics.closed')} />
          ) : (
            <StatusBadge
              color={CASH_SESSION_STATUS_COLORS[openSession.status]}
              label={cashSessionStatusLabel(locale, openSession.status)}
            />
          )
        }
        hint={openSession?.name ?? t('cashier.metrics.noOpenSession')}
        accent={openSession === null ? 'warning' : 'mint'}
        loading={sessions.loading}
      />
      <MetricCard
        label={t('cashier.metrics.expectedCash')}
        value={openSession === null ? '—' : formatMoney(openSession.expectedCashAmount, cup)}
        hint={
          openSession === null
            ? t('cashier.metrics.openHint')
            : t('cashier.metrics.opening', {
                amount: formatMoney(openSession.openingAmount, cup),
              })
        }
        accent="sky"
        loading={sessions.loading}
      />
      <MetricCard
        label={t('cashier.metrics.latestClose')}
        value={
          latestClose === null ? (
            t('cashier.metrics.noClose')
          ) : (
            <StatusBadge
              color={OPERATIONAL_CLOSE_COLORS[latestClose.status]}
              label={operationalCloseStatusLabel(locale, latestClose.status)}
            />
          )
        }
        hint={
          latestClose === null
            ? t('cashier.metrics.noCloseHint')
            : formatCalendarDate(latestClose.operationalDate)
        }
        accent={latestClose?.status === 'CLOSED' ? 'mint' : 'warning'}
        loading={closes.loading}
      />
    </SimpleGrid>
  );
}
