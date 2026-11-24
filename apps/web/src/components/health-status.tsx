'use client';

import { Badge, Box, Button, Code, HStack, Stack, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { SectionCard } from './ui';

interface ReadinessResponse {
  status: 'ok' | 'error';
  timestamp: string;
  checks?: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReadinessResponse }
  | { kind: 'unavailable'; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function DependencyBadge({ label, value }: { label: string; value: 'up' | 'down' | undefined }) {
  const { t } = useI18n();
  const ok = value === 'up';
  return (
    <HStack
      spacing={2}
      px={3}
      py={2}
      borderWidth="1px"
      borderColor={ok ? 'mint.100' : 'danger.100'}
      borderRadius="lg"
      bg={ok ? 'mint.50' : 'danger.50'}
    >
      <Box boxSize="7px" borderRadius="full" bg={ok ? 'mint.500' : 'danger.500'} />
      <Text fontSize="xs" fontWeight="semibold">
        {label}
      </Text>
      <Badge colorScheme={ok ? 'mint' : 'danger'} ml="auto">
        {value ?? t('healthStatus.unknown')}
      </Badge>
    </HStack>
  );
}

export function HealthStatus() {
  const { t, intlLocale } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`${API_URL}/health/ready`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as ReadinessResponse;

      if (response.ok) {
        setState({ kind: 'ready', data });
      } else {
        setState({
          kind: 'unavailable',
          message: t('healthStatus.httpError', { status: response.status }),
        });
      }
    } catch {
      setState({
        kind: 'unavailable',
        message: t('healthStatus.unreachable', { url: API_URL }),
      });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Text fontWeight="semibold" fontSize="sm">
            {t('healthStatus.title')}
          </Text>
          <Text fontSize="xs" color="textSecondary">
            {t('healthStatus.subtitle')}
          </Text>
        </Box>
        <HStack spacing={2}>
          {state.kind === 'ready' && <Badge colorScheme="mint">{t('healthStatus.ready')}</Badge>}
          {state.kind === 'unavailable' && (
            <Badge colorScheme="danger">{t('healthStatus.notReady')}</Badge>
          )}
          <Button
            size="xs"
            variant="outline"
            onClick={() => void load()}
            isLoading={state.kind === 'loading'}
          >
            {t('healthStatus.retry')}
          </Button>
        </HStack>
      </HStack>

      {state.kind === 'loading' && (
        <Text fontSize="sm" color="textSecondary">
          {t('healthStatus.loading')}
        </Text>
      )}

      {state.kind === 'ready' && (
        <Stack spacing={2}>
          <SimpleDependencies checks={state.data.checks} />
          <Text fontSize="xs" color="textSecondary">
            {t('healthStatus.lastCheck', {
              date: new Date(state.data.timestamp).toLocaleString(intlLocale),
            })}
          </Text>
        </Stack>
      )}

      {state.kind === 'unavailable' && (
        <Stack spacing={2}>
          <Text fontSize="sm">{state.message}</Text>
          <Text fontSize="xs" color="textSecondary">
            {t('healthStatus.expectedConfig')} <Code>{API_URL}</Code>
          </Text>
        </Stack>
      )}
    </SectionCard>
  );
}

function SimpleDependencies({ checks }: { checks?: ReadinessResponse['checks'] }) {
  return (
    <HStack spacing={3} wrap="wrap">
      <DependencyBadge label="PostgreSQL" value={checks?.database} />
      <DependencyBadge label="Redis" value={checks?.redis} />
    </HStack>
  );
}
