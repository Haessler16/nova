'use client';

import { Box, Divider, Flex, Heading, HStack, Skeleton, Stack, Text } from '@chakra-ui/react';
import { AlertItem, EmptyState, SectionCard } from '@/components/ui';
import { AlertTriangleIcon, CheckCircleIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';
import { buildDashboardAlerts } from '../_lib/dashboard-alerts';

export function AlertsPanel({
  data,
  loading,
}: {
  data: FrontOfficeOverview | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const alerts = buildDashboardAlerts(t, data);

  return (
    <SectionCard>
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="sm">{t('dashboard.alerts.title')}</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {t('dashboard.alerts.hint')}
          </Text>
        </Box>
        <Flex
          boxSize="34px"
          align="center"
          justify="center"
          borderRadius="md"
          bg={alerts.length === 0 ? 'mint.50' : 'warning.50'}
          color={alerts.length === 0 ? 'mint.600' : 'warning.700'}
        >
          {alerts.length === 0 ? (
            <CheckCircleIcon boxSize={4} />
          ) : (
            <AlertTriangleIcon boxSize={4} />
          )}
        </Flex>
      </HStack>

      <Divider my={4} />

      {loading && data === null ? (
        <Stack spacing={2}>
          {[0, 1].map((row) => (
            <Skeleton key={row} height="58px" borderRadius="lg" />
          ))}
        </Stack>
      ) : alerts.length === 0 ? (
        <EmptyState text={t('dashboard.alerts.none')} hint={t('dashboard.alerts.noneHint')} />
      ) : (
        <Stack spacing={1}>
          {alerts.map((alert) => (
            <AlertItem
              key={alert.title}
              title={alert.title}
              description={alert.description}
              href={alert.href}
              icon={alert.icon}
              tone={alert.tone}
            />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
