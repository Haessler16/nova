'use client';

import {
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { EmptyState, MetricCard, QueryFeedback, SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { ReportResult } from '@/lib/types';
import { formatCell, formatSummary } from '../_lib/report-format';
import { ReportResultHeader } from './report-result-header';

export function ReportResultPanel({
  result,
  error,
  running,
  onRun,
}: {
  result: ReportResult | null;
  error: unknown;
  running: boolean;
  onRun: (page: number) => void;
}) {
  const { t } = useI18n();

  if (result === null) {
    return (
      <SectionCard>
        {running ? (
          <QueryFeedback loading error={null}>
            <Box />
          </QueryFeedback>
        ) : error !== null ? (
          <QueryFeedback loading={false} error={error} onRetry={() => onRun(1)}>
            <Box />
          </QueryFeedback>
        ) : (
          <EmptyState text={t('reports.empty.text')} hint={t('reports.empty.hint')} />
        )}
      </SectionCard>
    );
  }

  const rows = result.rows;
  const summary = result.summary;

  return (
    <Stack spacing={5}>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
        {summary.map((item) => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={formatSummary(item, result.currencyCode)}
            accent={item.format === 'currency' ? 'mint' : 'brand'}
          />
        ))}
      </SimpleGrid>

      <SectionCard>
        <ReportResultHeader result={result} />

        <QueryFeedback
          loading={running}
          error={error}
          onRetry={() => onRun(result.page)}
          isEmpty={rows.length === 0}
          emptyText={t('reports.rowsEmpty')}
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  {result.columns.map((column) => (
                    <Th key={column.key} isNumeric={column.align === 'right'}>
                      {column.label}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row, index) => (
                  <Tr key={`${result.executionId}-${index}`}>
                    {result.columns.map((column) => (
                      <Td
                        key={column.key}
                        isNumeric={column.align === 'right'}
                        whiteSpace={column.format === 'text' ? 'normal' : 'nowrap'}
                      >
                        {formatCell(row[column.key], column.format, result.currencyCode)}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          <Divider my={4} />
          <Flex justify="space-between" align="center" gap={3} wrap="wrap">
            <Text fontSize="xs" color="textSecondary">
              {t('reports.pagination', {
                page: result.page,
                pages: Math.max(result.totalPages, 1),
                rows: result.totalRows,
              })}
            </Text>
            <HStack spacing={2}>
              <Button
                size="xs"
                variant="outline"
                isDisabled={result.page <= 1 || running}
                onClick={() => onRun(result.page - 1)}
              >
                {t('reports.previous')}
              </Button>
              <Button
                size="xs"
                variant="outline"
                isDisabled={result.page >= result.totalPages || running}
                onClick={() => onRun(result.page + 1)}
              >
                {t('reports.next')}
              </Button>
            </HStack>
          </Flex>
        </QueryFeedback>
      </SectionCard>
    </Stack>
  );
}
