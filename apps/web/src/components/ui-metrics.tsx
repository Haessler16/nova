'use client';

import {
  Badge,
  Box,
  Flex,
  HStack,
  Link,
  Skeleton,
  Text,
  type BoxProps,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

type Accent = 'brand' | 'mint' | 'warning' | 'danger' | 'sky';

const ACCENT_STYLES: Record<Accent, { bg: string; color: string; bar: string }> = {
  brand: { bg: 'brand.50', color: 'brand.600', bar: 'brand.500' },
  sky: { bg: 'sky.50', color: 'sky.600', bar: 'sky.500' },
  mint: { bg: 'mint.50', color: 'mint.600', bar: 'mint.500' },
  warning: { bg: 'warning.50', color: 'warning.700', bar: 'warning.500' },
  danger: { bg: 'danger.50', color: 'danger.600', bar: 'danger.500' },
};

export function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <Badge colorScheme={color} variant="subtle" textTransform="none" fontWeight="semibold">
      {label}
    </Badge>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = 'brand',
  progress,
  loading = false,
  ...props
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: Accent;
  progress?: number;
  loading?: boolean;
} & BoxProps) {
  const tone = ACCENT_STYLES[accent];

  return (
    <Box
      borderWidth="1px"
      borderColor="line"
      borderRadius="xl"
      bg="surface"
      boxShadow="card"
      p={5}
      minW={0}
      {...props}
    >
      <HStack justify="space-between" align="flex-start" spacing={3}>
        <Box minW={0}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="textSecondary"
            textTransform="uppercase"
            letterSpacing="0.08em"
            noOfLines={1}
          >
            {label}
          </Text>
          {loading ? (
            <Skeleton height="34px" width="90px" mt={2} borderRadius="md" />
          ) : (
            <Text fontSize="2xl" fontWeight="bold" lineHeight="1.15" mt={1.5}>
              {value}
            </Text>
          )}
          {hint !== undefined && !loading && (
            <Text fontSize="xs" color="textSecondary" mt={1} noOfLines={2}>
              {hint}
            </Text>
          )}
        </Box>
        {icon !== undefined && (
          <Flex
            boxSize="40px"
            flexShrink={0}
            align="center"
            justify="center"
            borderRadius="lg"
            bg={tone.bg}
            color={tone.color}
          >
            {icon}
          </Flex>
        )}
      </HStack>
      {progress !== undefined && (
        <Box mt={4} h="5px" bg="gray.200" borderRadius="full" overflow="hidden">
          <Box
            h="100%"
            width={`${Math.min(Math.max(progress, 0), 100)}%`}
            bg={tone.bar}
            borderRadius="full"
          />
        </Box>
      )}
    </Box>
  );
}

export function AlertItem({
  title,
  description,
  count,
  href,
  icon,
  tone = 'warning',
}: {
  title: string;
  description: string;
  count?: number;
  href?: string;
  icon?: ReactNode;
  tone?: Accent;
}) {
  const styles = ACCENT_STYLES[tone];

  const content = (
    <HStack
      spacing={3}
      align="flex-start"
      px={3}
      py={3}
      borderRadius="lg"
      borderWidth="1px"
      borderColor="transparent"
      transition="background-color 120ms ease, border-color 120ms ease"
      _hover={href !== undefined ? { bg: 'gray.50', borderColor: 'line' } : { bg: 'transparent' }}
    >
      {icon !== undefined && (
        <Flex
          boxSize="34px"
          flexShrink={0}
          align="center"
          justify="center"
          borderRadius="md"
          bg={styles.bg}
          color={styles.color}
        >
          {icon}
        </Flex>
      )}
      <Box flex="1" minW={0}>
        <HStack spacing={2} justify="space-between" align="flex-start">
          <Text fontSize="sm" fontWeight="semibold" noOfLines={2}>
            {title}
          </Text>
          {count !== undefined && (
            <Badge colorScheme={tone} flexShrink={0}>
              {count}
            </Badge>
          )}
        </HStack>
        <Text fontSize="xs" color="textSecondary" mt={0.5}>
          {description}
        </Text>
      </Box>
    </HStack>
  );

  if (href === undefined) {
    return content;
  }

  return (
    <Link
      as={NextLink}
      href={href}
      display="block"
      color="inherit"
      _hover={{ color: 'inherit', textDecoration: 'none' }}
      borderRadius="lg"
      _focusVisible={{ boxShadow: 'focus' }}
    >
      {content}
    </Link>
  );
}
