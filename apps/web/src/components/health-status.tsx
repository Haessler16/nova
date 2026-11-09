'use client';

import { Badge, Box, Button, Code, HStack, Stack, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
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
        {value ?? 'unknown'}
      </Badge>
    </HStack>
  );
}

export function HealthStatus() {
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
          message: `API respondió ${response.status}. Revisá PostgreSQL y Redis.`,
        });
      }
    } catch {
      setState({
        kind: 'unavailable',
        message: `No se pudo contactar la API en ${API_URL}.`,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Text fontWeight="semibold" fontSize="sm">
            Dependencias de la plataforma
          </Text>
          <Text fontSize="xs" color="textSecondary">
            Readiness de API, PostgreSQL y Redis.
          </Text>
        </Box>
        <HStack spacing={2}>
          {state.kind === 'ready' && <Badge colorScheme="mint">API ready</Badge>}
          {state.kind === 'unavailable' && <Badge colorScheme="danger">API not ready</Badge>}
          <Button
            size="xs"
            variant="outline"
            onClick={() => void load()}
            isLoading={state.kind === 'loading'}
          >
            Reintentar
          </Button>
        </HStack>
      </HStack>

      {state.kind === 'loading' && (
        <Text fontSize="sm" color="textSecondary">
          Consultando readiness…
        </Text>
      )}

      {state.kind === 'ready' && (
        <Stack spacing={2}>
          <SimpleDependencies checks={state.data.checks} />
          <Text fontSize="xs" color="textSecondary">
            Última verificación: {new Date(state.data.timestamp).toLocaleString('es-AR')}
          </Text>
        </Stack>
      )}

      {state.kind === 'unavailable' && (
        <Stack spacing={2}>
          <Text fontSize="sm">{state.message}</Text>
          <Text fontSize="xs" color="textSecondary">
            Configuración esperada: <Code>{API_URL}</Code>
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
