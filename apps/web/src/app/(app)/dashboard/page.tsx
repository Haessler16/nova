'use client';

import { Box, Button, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { ConnectionStatus } from '@/components/connection-status';
import { HealthStatus } from '@/components/health-status';
import { EmptyState, ErrorAlert, PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { formatLongDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, OperationalDay, PropertyDetail } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { AlertsPanel } from './_components/alerts-panel';
import { ArrivalsPanel } from './_components/arrivals-panel';
import { ContextPanel } from './_components/context-panel';
import { DashboardMetrics } from './_components/dashboard-metrics';
import { DashboardSkeleton } from './_components/dashboard-skeleton';
import { QuickActions } from './_components/quick-actions';
import { deriveOverviewMetrics } from './_lib/dashboard-derived';
import { firstName, greetingLabel } from './_lib/dashboard-text';

interface DashboardBase {
  property: PropertyDetail;
  operationalDay: OperationalDay;
}

function DashboardContent(): ReactNode {
  const { tenant, property, organization, actor } = useSession();
  const { t } = useI18n();

  const base = useAsyncData<DashboardBase>(async () => {
    const [propertyDetail, operationalDay] = await Promise.all([
      api<PropertyDetail>('/api/v1/properties/current', { tenant }),
      api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    ]);
    return { property: propertyDetail, operationalDay };
  }, `${tenant.organizationId}:${tenant.propertyId}:dashboard:base`);

  const overview = useAsyncData<FrontOfficeOverview>(
    () => api<FrontOfficeOverview>('/api/v1/front-office/overview', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:dashboard:overview`,
  );

  const operationalDay = base.data?.operationalDay ?? null;
  const propertyDetail = base.data?.property ?? null;
  const overviewData = overview.data;

  const { totalRooms, occupancy, readyRooms } = deriveOverviewMetrics(overviewData);

  function reloadAll(): void {
    base.reload();
    overview.reload();
  }

  if (base.loading && base.data === null) {
    return <DashboardSkeleton />;
  }

  if (base.error !== null && base.error !== undefined) {
    return <ErrorAlert error={base.error} onRetry={base.reload} />;
  }

  if (propertyDetail === null || operationalDay === null) {
    return <EmptyState text={t('dashboard.contextError')} hint={t('dashboard.contextErrorHint')} />;
  }

  const displayName = firstName(actor?.name);
  const greeting = greetingLabel(t, operationalDay.localTime);
  const metricsUnavailable = overview.error !== null && overview.error !== undefined;

  return (
    <>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={`${greeting}${displayName !== '' ? `, ${displayName}` : ''}`}
        description={`${formatLongDate(operationalDay.localDate)} · Front Desk · ${
          property?.name ?? propertyDetail.name
        } (${organization?.name ?? t('dashboard.organizationFallback')})`}
        actions={
          <>
            <Box display={{ base: 'block', sm: 'none' }}>
              <ConnectionStatus />
            </Box>
            <Button
              size="sm"
              variant="outline"
              onClick={reloadAll}
              isLoading={base.loading || overview.loading}
            >
              {t('dashboard.update')}
            </Button>
            <Button as={NextLink} href="/front-office" size="sm">
              {t('dashboard.openFrontDesk')}
            </Button>
          </>
        }
      />

      <Stack spacing={6}>
        {metricsUnavailable ? (
          <SectionCard>
            <Heading size="sm" mb={1}>
              {t('dashboard.metricsUnavailable')}
            </Heading>
            <Text fontSize="xs" color="textSecondary" mb={3}>
              {t('dashboard.metricsUnavailableHint')}
            </Text>
            <ErrorAlert error={overview.error} onRetry={overview.reload} />
          </SectionCard>
        ) : (
          <>
            <DashboardMetrics
              overviewData={overviewData}
              loading={overview.loading}
              occupancy={occupancy}
              totalRooms={totalRooms}
              readyRooms={readyRooms}
            />

            <QuickActions />

            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5} alignItems="start">
              <Box gridColumn={{ xl: 'span 2' }} minW={0}>
                <ArrivalsPanel
                  data={overviewData ?? null}
                  loading={overview.loading}
                  operationalDate={operationalDay.operationalDate}
                />
              </Box>
              <Stack spacing={5} minW={0}>
                <AlertsPanel data={overviewData ?? null} loading={overview.loading} />
                <ContextPanel property={propertyDetail} operationalDay={operationalDay} />
              </Stack>
            </SimpleGrid>
          </>
        )}

        <Box>
          <Heading size="sm" mb={3}>
            {t('dashboard.platform')}
          </Heading>
          <HealthStatus />
        </Box>

        <Text fontSize="xs" color="textSecondary">
          {t('dashboard.footer')}
        </Text>
      </Stack>
    </>
  );
}

export default function DashboardPage() {
  return (
    <PropertyGate>
      <DashboardContent />
    </PropertyGate>
  );
}
