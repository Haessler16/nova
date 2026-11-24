'use client';

import { Box, SimpleGrid, Skeleton, Stack } from '@chakra-ui/react';

export function DashboardSkeleton() {
  return (
    <Stack spacing={6}>
      <Box>
        <Skeleton height="12px" width="220px" borderRadius="md" />
        <Skeleton height="34px" width="420px" mt={3} borderRadius="md" />
        <Skeleton height="14px" width="320px" mt={3} borderRadius="md" />
      </Box>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height="132px" borderRadius="xl" />
        ))}
      </SimpleGrid>
      <Skeleton height="120px" borderRadius="xl" />
      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5}>
        <Skeleton gridColumn={{ xl: 'span 2' }} height="360px" borderRadius="xl" />
        <Skeleton height="360px" borderRadius="xl" />
      </SimpleGrid>
    </Stack>
  );
}
