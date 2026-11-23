'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { MetricCard, StatusBadge } from '@/components/ui';
import {
  CASH_SESSION_STATUS_COLORS,
  CASH_SESSION_STATUS_LABELS,
  OPERATIONAL_CLOSE_COLORS,
  OPERATIONAL_CLOSE_LABELS,
  formatCalendarDate,
  formatMoney,
} from '@/lib/format';
import type { CashierData } from '../_hooks/use-cashier-data';

export function CashierMetrics({ data }: { data: CashierData }) {
  const { operationalDay, sessions, closes, openSession, latestClose, cup } = data;

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={5}>
      <MetricCard
        label="Día operativo"
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
        label="Caja"
        value={
          openSession === null ? (
            <StatusBadge color="warning" label="Cerrada" />
          ) : (
            <StatusBadge
              color={CASH_SESSION_STATUS_COLORS[openSession.status]}
              label={CASH_SESSION_STATUS_LABELS[openSession.status]}
            />
          )
        }
        hint={openSession?.name ?? 'Sin sesión abierta'}
        accent={openSession === null ? 'warning' : 'mint'}
        loading={sessions.loading}
      />
      <MetricCard
        label="Efectivo esperado"
        value={openSession === null ? '—' : formatMoney(openSession.expectedCashAmount, cup)}
        hint={
          openSession === null
            ? 'Abrí una caja para operar'
            : `Apertura ${formatMoney(openSession.openingAmount, cup)}`
        }
        accent="sky"
        loading={sessions.loading}
      />
      <MetricCard
        label="Último cierre"
        value={
          latestClose === null ? (
            'Sin cierre'
          ) : (
            <StatusBadge
              color={OPERATIONAL_CLOSE_COLORS[latestClose.status]}
              label={OPERATIONAL_CLOSE_LABELS[latestClose.status]}
            />
          )
        }
        hint={
          latestClose === null
            ? 'Todavía no se cerró un día'
            : formatCalendarDate(latestClose.operationalDate)
        }
        accent={latestClose?.status === 'CLOSED' ? 'mint' : 'warning'}
        loading={closes.loading}
      />
    </SimpleGrid>
  );
}
