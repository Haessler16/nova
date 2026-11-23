'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { MetricCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';

export function FrontOfficeMetrics({ data }: { data: FrontOfficeOverview }) {
  const { t } = useI18n();

  return (
    <SimpleGrid columns={{ base: 2, md: 3, xl: data.isHistorical ? 4 : 6 }} spacing={3}>
      <MetricCard label={t('frontOffice.metric.arrivals')} value={data.counts.arrivals} accent="sky" />
      <MetricCard
        label={t(data.isHistorical ? 'frontOffice.metric.hosted' : 'frontOffice.metric.inHouse')}
        value={data.counts.inHouse}
        accent="mint"
      />
      <MetricCard
        label={t('frontOffice.metric.departures')}
        value={data.counts.departures}
        accent="warning"
      />
      {data.isHistorical ? (
        <MetricCard
          label={t('frontOffice.metric.noShow')}
          value={data.counts.noShowCandidates}
          hint={t('frontOffice.metric.noShowHint')}
          accent="danger"
        />
      ) : (
        <>
          <MetricCard
            label={t('frontOffice.metric.free')}
            value={data.counts.vacantRooms}
            accent="mint"
          />
          <MetricCard
            label={t('frontOffice.metric.occupied')}
            value={data.counts.occupiedRooms}
            accent="brand"
          />
          <MetricCard
            label={t('frontOffice.metric.noShowPending')}
            value={data.counts.noShowCandidates}
            hint={t('frontOffice.metric.noShowPendingHint')}
            accent="danger"
          />
        </>
      )}
    </SimpleGrid>
  );
}
