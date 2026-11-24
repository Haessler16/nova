'use client';

import { Badge, Box, HStack, Heading, Text } from '@chakra-ui/react';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReportResult } from '@/lib/types';
import { formatZonedDateTime } from '../_lib/report-format';

export function ReportResultHeader({ result }: { result: ReportResult }) {
  const { t } = useI18n();

  return (
    <HStack justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
      <Box>
        <Heading size="sm">{result.title}</Heading>
        <Text fontSize="xs" color="textSecondary" mt={1}>
          {t('reports.history.period', {
            from: formatCalendarDate(result.filters.from),
            to: formatCalendarDate(result.filters.to),
          })}{' '}
          · {result.timezone} ·{' '}
          {t('reports.generated', {
            date: formatZonedDateTime(result.generatedAt, result.timezone),
          })}
        </Text>
      </Box>
      <Badge colorScheme="sky">{t('reports.rowsBadge', { count: result.totalRows })}</Badge>
    </HStack>
  );
}
