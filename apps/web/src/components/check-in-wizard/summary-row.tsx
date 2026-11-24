'use client';

import { Box, Text } from '@chakra-ui/react';

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.500">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {value}
      </Text>
    </Box>
  );
}
