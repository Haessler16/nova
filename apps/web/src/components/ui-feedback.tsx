'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Center,
  Spinner,
  Text,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

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
