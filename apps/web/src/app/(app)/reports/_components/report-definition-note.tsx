'use client';

import { Box, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { ReportDefinitionSummary } from '@/lib/types';

export function ReportDefinitionNote({
  definition,
}: {
  definition: ReportDefinitionSummary | null;
}) {
  const { t } = useI18n();

  if (definition === null) {
    return null;
  }

  return (
    <Box mt={4} p={3} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="line">
      <Text fontSize="sm" fontWeight="semibold">
        {definition.title}
      </Text>
      <Text fontSize="xs" color="textSecondary" mt={1}>
        {definition.description}
      </Text>
      {!definition.allowed && (
        <Text fontSize="xs" color="warning.700" mt={2}>
          {t('reports.permissionDenied', { permission: definition.permission })}
        </Text>
      )}
    </Box>
  );
}
