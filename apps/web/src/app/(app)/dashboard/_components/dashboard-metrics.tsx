'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { MetricCard } from '@/components/ui';
import { ArrivalIcon, BedIcon, DepartureIcon, KeyIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';

export function DashboardMetrics({
  overviewData,
  loading,
  occupancy,
  totalRooms,
  readyRooms,
}: {
  overviewData: FrontOfficeOverview | null | undefined;
  loading: boolean;
  occupancy: number | null;
  totalRooms: number;
  readyRooms: number;
}) {
  const { t } = useI18n();
  const pending = loading && overviewData === null;

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
      <MetricCard
        label={t('dashboard.metric.occupancy')}
        value={occupancy !== null ? `${occupancy}%` : '—'}
        hint={
          overviewData !== null && overviewData !== undefined
            ? t('dashboard.metric.occupancyHint', {
                occupied: overviewData.counts.occupiedRooms,
                total: totalRooms,
              })
            : t('dashboard.metric.occupancyFallback')
        }
        icon={<BedIcon boxSize={5} />}
        accent="brand"
        progress={occupancy ?? undefined}
        loading={pending}
      />
      <MetricCard
        label={t('dashboard.metric.arrivals')}
        value={overviewData?.counts.arrivals ?? '—'}
        hint={t('dashboard.metric.arrivalsHint')}
        icon={<ArrivalIcon boxSize={5} />}
        accent="sky"
        loading={pending}
      />
      <MetricCard
        label={t('dashboard.metric.departures')}
        value={overviewData?.counts.departures ?? '—'}
        hint={t('dashboard.metric.departuresHint')}
        icon={<DepartureIcon boxSize={5} />}
        accent="warning"
        loading={pending}
      />
      <MetricCard
        label={t('dashboard.metric.readyRooms')}
        value={overviewData !== null && overviewData !== undefined ? readyRooms : '—'}
        hint={t('dashboard.metric.readyRoomsHint')}
        icon={<KeyIcon boxSize={5} />}
        accent="mint"
        loading={pending}
      />
    </SimpleGrid>
  );
}
