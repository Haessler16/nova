'use client';

import { Box, Button, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { QueryFeedback, SectionCard } from '@/components/ui';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReportDefinitionSummary, ReportExecution } from '@/lib/types';

export function ReportHistory({
  executions,
  definitions,
  loading,
  error,
  onReload,
}: {
  executions: ReportExecution[];
  definitions: ReportDefinitionSummary[];
  loading: boolean;
  error: unknown;
  onReload: () => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard mt={5}>
      <HStack justify="space-between" align="flex-start" mb={3}>
        <Box>
          <Heading size="sm">{t('reports.history.title')}</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {t('reports.history.hint')}
          </Text>
        </Box>
        <Button size="xs" variant="ghost" onClick={onReload} isLoading={loading}>
          {t('reports.history.refresh')}
        </Button>
      </HStack>
      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onReload}
        isEmpty={executions.length === 0}
        emptyText={t('reports.history.empty')}
      >
        <Stack spacing={0}>
          {executions.slice(0, 8).map((execution) => {
            const reportTitle =
              definitions.find((item) => item.key === execution.metadata?.reportKey)?.title ??
              execution.metadata?.reportKey;
            return (
              <Flex
                key={execution.id}
                justify="space-between"
                gap={3}
                py={2.5}
                borderBottomWidth="1px"
                borderColor="gray.100"
                _last={{ borderBottomWidth: 0 }}
                wrap="wrap"
              >
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">
                    {reportTitle ?? t('reports.reportFallback')} ·{' '}
                    {execution.action === 'report.exported'
                      ? t('reports.history.exported')
                      : t('reports.history.executed')}
                  </Text>
                  <Text fontSize="xs" color="textSecondary">
                    {execution.metadata?.from !== undefined &&
                    execution.metadata?.to !== undefined
                      ? t('reports.history.period', {
                          from: formatCalendarDate(execution.metadata.from),
                          to: formatCalendarDate(execution.metadata.to),
                        })
                      : t('reports.history.periodUnavailable')}
                    {execution.metadata?.format !== undefined
                      ? ` · ${execution.metadata.format}`
                      : ''}
                    {execution.metadata?.rowCount !== undefined
                      ? t('reports.history.rows', { count: execution.metadata.rowCount })
                      : ''}
                  </Text>
                </Box>
                <Text fontSize="xs" color="textSecondary">
                  {formatDateTime(execution.occurredAt)}
                </Text>
              </Flex>
            );
          })}
        </Stack>
      </QueryFeedback>
    </SectionCard>
  );
}
