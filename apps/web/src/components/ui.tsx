'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Link,
  Skeleton,
  Spinner,
  Stack,
  Text,
  type BoxProps,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Accent = 'brand' | 'mint' | 'warning' | 'danger' | 'sky';

const ACCENT_STYLES: Record<Accent, { bg: string; color: string; bar: string }> = {
  brand: { bg: 'brand.50', color: 'brand.600', bar: 'brand.500' },
  sky: { bg: 'sky.50', color: 'sky.600', bar: 'sky.500' },
  mint: { bg: 'mint.50', color: 'mint.600', bar: 'mint.500' },
  warning: { bg: 'warning.50', color: 'warning.700', bar: 'warning.500' },
  danger: { bg: 'danger.50', color: 'danger.600', bar: 'danger.500' },
};

function ArrowRightIcon(props?: Record<string, unknown>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CaretDownIcon(props?: Record<string, unknown>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

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

export function RowActionLink({
  href,
  children,
  label,
  onClick,
}: {
  href: string;
  children: ReactNode;
  label: string;
  /** Client-side behaviour the destination also supports via its query param. */
  onClick?: () => void;
}) {
  return (
    <Link
      as={NextLink}
      href={href}
      onClick={onClick}
      display="inline-flex"
      alignItems="center"
      gap={2}
      px={2.5}
      py={1.5}
      borderRadius="md"
      fontSize="sm"
      fontWeight="semibold"
      textDecoration="none"
      color="brand.800"
      bg="brand.50"
      borderWidth="1px"
      borderColor="brand.300"
      _hover={{ bg: 'brand.100', borderColor: 'brand.400', textDecoration: 'none' }}
      _focusVisible={{ boxShadow: 'focus' }}
      aria-label={label}
    >
      {children}
      <ArrowRightIcon boxSize={4} />
    </Link>
  );
}

export function RowActionButton({
  children,
  onClick,
  colorScheme = 'gray',
  isLoading = false,
}: {
  children: ReactNode;
  onClick: () => void;
  colorScheme?: 'gray' | 'brand' | 'sky' | 'mint' | 'warning' | 'danger';
  isLoading?: boolean;
}) {
  return (
    <Button
      size="xs"
      variant="outline"
      colorScheme={colorScheme}
      onClick={onClick}
      isLoading={isLoading}
      fontWeight="semibold"
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
      <CaretDownIcon boxSize={3.5} ml={1} aria-hidden="true" />
    </Button>
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

export function Field({
  label,
  children,
  isRequired = false,
  helper,
  error,
}: {
  label: string;
  children: ReactNode;
  isRequired?: boolean;
  helper?: string;
  error?: string | null;
}) {
  const hasError = error !== undefined && error !== null && error !== '';
  return (
    <FormControl isRequired={isRequired} isInvalid={hasError}>
      <FormLabel fontSize="sm" fontWeight="semibold" mb={1}>
        {label}
      </FormLabel>
      {children}
      {hasError ? (
        <FormErrorMessage mt={1}>{error}</FormErrorMessage>
      ) : (
        helper !== undefined && <FormHelperText mt={1}>{helper}</FormHelperText>
      )}
    </FormControl>
  );
}

export function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <Badge colorScheme={color} variant="subtle" textTransform="none" fontWeight="semibold">
      {label}
    </Badge>
  );
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();

  return (
    <Alert
      status="error"
      borderRadius="xl"
      alignItems="flex-start"
      bg="danger.50"
      borderWidth="1px"
      borderColor="danger.100"
    >
      <AlertIcon color="danger.500" />
      <Box flex="1">
        <AlertDescription fontSize="sm">{errorMessage(error)}</AlertDescription>
      </Box>
      {onRetry !== undefined && (
        <Button size="xs" variant="outline" colorScheme="danger" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </Alert>
  );
}

export function QueryFeedback({
  loading,
  error,
  onRetry,
  isEmpty = false,
  emptyText,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <Center py={10}>
        <Spinner size="sm" mr={3} />
        <Text color="textSecondary" fontSize="sm">
          {t('common.loading')}
        </Text>
      </Center>
    );
  }

  if (error !== null && error !== undefined) {
    return <ErrorAlert error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState text={emptyText ?? t('common.emptyDefault')} />;
  }

  return <>{children}</>;
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <Center
      py={10}
      px={4}
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="line"
      borderRadius="xl"
      bg="gray.100"
      flexDirection="column"
      textAlign="center"
    >
      <Text color="textPrimary" fontSize="sm" fontWeight="semibold">
        {text}
      </Text>
      {hint !== undefined && (
        <Text color="textSecondary" fontSize="xs" mt={1}>
          {hint}
        </Text>
      )}
    </Center>
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
