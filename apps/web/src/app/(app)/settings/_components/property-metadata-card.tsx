'use client';

import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { PropertyDetail } from '@/lib/types';

export function PropertyMetadataCard({ property }: { property: PropertyDetail }) {
  return (
    <SectionCard>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">Metadatos</Text>
        <Badge colorScheme={property.status === 'ACTIVE' ? 'mint' : 'gray'}>
          {property.status}
        </Badge>
      </HStack>
      <Stack spacing={2}>
        <KeyValue label="Código" value={property.code} />
        <KeyValue
          label="Property ID"
          value={
            <Box as="code" fontSize="xs">
              {property.id}
            </Box>
          }
        />
        <KeyValue label="Creada" value={formatDateTime(property.createdAt)} />
        <KeyValue label="Actualizada" value={formatDateTime(property.updatedAt)} />
      </Stack>
    </SectionCard>
  );
}
