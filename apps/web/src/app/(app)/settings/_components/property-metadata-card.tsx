'use client';

import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { PropertyDetail } from '@/lib/types';

export function PropertyMetadataCard({ property }: { property: PropertyDetail }) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">{t('settings.meta.title')}</Text>
        <Badge colorScheme={property.status === 'ACTIVE' ? 'mint' : 'gray'}>
          {property.status}
        </Badge>
      </HStack>
      <Stack spacing={2}>
        <KeyValue label={t('settings.meta.code')} value={property.code} />
        <KeyValue
          label={t('settings.meta.id')}
          value={
            <Box as="code" fontSize="xs">
              {property.id}
            </Box>
          }
        />
        <KeyValue label={t('settings.meta.createdAt')} value={formatDateTime(property.createdAt)} />
        <KeyValue label={t('settings.meta.updatedAt')} value={formatDateTime(property.updatedAt)} />
      </Stack>
    </SectionCard>
  );
}
