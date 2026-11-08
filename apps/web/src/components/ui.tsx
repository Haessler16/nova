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
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  type BoxProps,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      direction={{ base: 'column', md: 'row' }}
      gap={3}
      mb={6}
    >
      <Box>
        <Heading size="lg">{title}</Heading>
        {description !== undefined && (
          <Text color="gray.600" fontSize="sm" mt={1} maxW="3xl">
            {description}
          </Text>
        )}
      </Box>
      {actions !== undefined && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}

export function SectionCard({ children, ...props }: BoxProps & { children: ReactNode }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={5} {...props}>
      {children}
    </Box>
  );
}

export function Field({
  label,
  children,
  isRequired = false,
  helper,
}: {
  label: string;
  children: ReactNode;
  isRequired?: boolean;
  helper?: string;
}) {
  return (
    <FormControl isRequired={isRequired}>
      <FormLabel fontSize="sm" mb={1}>
        {label}
      </FormLabel>
      {children}
      {helper !== undefined && <FormHelperText mt={1}>{helper}</FormHelperText>}
    </FormControl>
  );
}

export function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <Badge colorScheme={color} textTransform="none" fontWeight="medium">
      {label}
    </Badge>
  );
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert status="error" borderRadius="md" alignItems="flex-start">
      <AlertIcon />
      <Box flex="1">
        <AlertDescription fontSize="sm">{errorMessage(error)}</AlertDescription>
      </Box>
      {onRetry !== undefined && (
        <Button size="xs" variant="outline" onClick={onRetry}>
          Reintentar
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
  emptyText = 'No hay datos para mostrar.',
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Center py={10}>
        <Spinner size="sm" mr={3} />
        <Text color="gray.600" fontSize="sm">
          Cargando…
        </Text>
      </Center>
    );
  }

  if (error !== null && error !== undefined) {
    return <ErrorAlert error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <Center py={10} borderWidth="1px" borderStyle="dashed" borderRadius="md">
        <Text color="gray.500" fontSize="sm">
          {emptyText}
        </Text>
      </Center>
    );
  }

  return <>{children}</>;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack spacing={0}>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {value}
      </Text>
    </Stack>
  );
}
