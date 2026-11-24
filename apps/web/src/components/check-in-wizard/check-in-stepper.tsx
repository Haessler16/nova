'use client';

import { Badge, HStack } from '@chakra-ui/react';

export function CheckInStepper({ labels, step }: { labels: string[]; step: number }) {
  return (
    <HStack spacing={2} wrap="wrap">
      {labels.map((label, index) => (
        <Badge
          key={label}
          colorScheme={index === step ? 'brand' : index < step ? 'mint' : 'gray'}
          textTransform="none"
          px={2}
          py={1}
        >
          {index + 1}. {label}
        </Badge>
      ))}
    </HStack>
  );
}
