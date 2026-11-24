'use client';

import { Badge, Box, Divider, HStack, Heading, Stack, Text } from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { SparkleIcon } from '@/components/icons';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { OperationalDay, PropertyDetail } from '@/lib/types';

export function ContextPanel({
  property,
  operationalDay,
}: {
  property: PropertyDetail;
  operationalDay: OperationalDay;
}) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="sm">{t('dashboard.context.title')}</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {t('dashboard.context.hint')}
          </Text>
        </Box>
        <Badge colorScheme="mint">{property.timezone}</Badge>
      </HStack>
      <Divider my={4} />
      <Stack spacing={3}>
        <KeyValue
          label={t('dashboard.context.operationalDay')}
          value={formatCalendarDate(operationalDay.operationalDate)}
        />
        <KeyValue
          label={t('dashboard.context.localTime')}
          value={`${operationalDay.localTime} · ${operationalDay.timezone}`}
        />
        <KeyValue
          label={t('dashboard.context.cutoff')}
          value={operationalDay.operationalDayStart}
        />
        <KeyValue
          label={t('dashboard.context.property')}
          value={`${property.code} · ${property.currencyCode}`}
        />
      </Stack>
      <Divider my={4} />
      <HStack spacing={2} color="textSecondary">
        <SparkleIcon boxSize={4} color="brand.500" />
        <Text fontSize="xs">{t('dashboard.context.authority')}</Text>
      </HStack>
    </SectionCard>
  );
}
