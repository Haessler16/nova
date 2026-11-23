'use client';

import { Box, Flex, Heading, HStack, Stack, Text, type BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      direction={{ base: 'column', md: 'row' }}
      gap={4}
      mb={7}
    >
      <Box>
        {eyebrow !== undefined && (
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.16em"
            textTransform="uppercase"
            color="brand.700"
            mb={2}
          >
            {eyebrow}
          </Text>
        )}
        <Heading size="lg" fontSize={{ base: '1.4rem', md: '1.65rem' }} lineHeight="1.2">
          {title}
        </Heading>
        {description !== undefined && (
          <Text color="textSecondary" fontSize="sm" mt={2} maxW="4xl">
            {description}
          </Text>
        )}
      </Box>
      {actions !== undefined && (
        <HStack spacing={2} wrap="wrap" align="center">
          {actions}
        </HStack>
      )}
    </Flex>
  );
}

export function SectionCard({ children, ...props }: BoxProps & { children: ReactNode }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="line"
      borderRadius="xl"
      bg="surface"
      boxShadow="card"
      p={{ base: 4, md: 5 }}
      {...props}
    >
      {children}
    </Box>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack spacing={0}>
      <Text fontSize="xs" color="textSecondary" textTransform="uppercase" letterSpacing="0.08em">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {value}
      </Text>
    </Stack>
  );
}
