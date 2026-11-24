'use client';

import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { ReportsIcon } from '@/components/icons';
import { Field, QueryFeedback, SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { ReportDefinitionSummary, ReportKey } from '@/lib/types';
import { ReportDefinitionNote } from './report-definition-note';

export function ReportControls({
  items,
  loading,
  error,
  onRetry,
  selected,
  onSelect,
  from,
  to,
  onFromChange,
  onToChange,
  running,
  canRun,
  onRun,
  selectedDefinition,
}: {
  items: ReportDefinitionSummary[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selected: ReportKey;
  onSelect: (key: ReportKey) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  running: boolean;
  canRun: boolean;
  onRun: () => void;
  selectedDefinition: ReportDefinitionSummary | null;
}) {
  const { t } = useI18n();

  return (
    <SectionCard mb={5}>
      <HStack justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <HStack spacing={3}>
          <Flex
            boxSize="38px"
            align="center"
            justify="center"
            borderRadius="lg"
            bg="brand.50"
            color="brand.600"
          >
            <ReportsIcon boxSize={5} />
          </Flex>
          <Box>
            <Heading size="sm">{t('reports.catalog.title')}</Heading>
            <Text fontSize="xs" color="textSecondary">
              {t('reports.catalog.hint')}
            </Text>
          </Box>
        </HStack>
        {selectedDefinition !== null && (
          <Badge colorScheme={selectedDefinition.allowed ? 'mint' : 'warning'}>
            {selectedDefinition.category}
          </Badge>
        )}
      </HStack>

      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        isEmpty={items.length === 0}
        emptyText={t('reports.catalog.empty')}
      >
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={3} alignItems="end">
          <Field label={t('reports.field.report')} isRequired>
            <Select
              size="sm"
              value={selected}
              onChange={(event) => onSelect(event.target.value as ReportKey)}
            >
              {items.map((item) => (
                <option key={item.key} value={item.key} disabled={!item.allowed}>
                  {item.title}
                  {!item.allowed ? t('reports.noPermissionSuffix') : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('reports.field.from')} isRequired>
            <DateField
              value={from}
              onChange={onFromChange}
              ariaLabel={t('reports.field.fromLabel')}
            />
          </Field>
          <Field label={t('reports.field.to')} isRequired>
            <DateField value={to} onChange={onToChange} ariaLabel={t('reports.field.toLabel')} />
          </Field>
          <Button
            colorScheme="brand"
            size="sm"
            onClick={onRun}
            isLoading={running}
            isDisabled={!canRun}
          >
            {t('reports.run')}
          </Button>
        </SimpleGrid>

        <ReportDefinitionNote definition={selectedDefinition} />
      </QueryFeedback>
    </SectionCard>
  );
}
