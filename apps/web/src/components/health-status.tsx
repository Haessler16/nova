'use client';

import { Badge, Box, Button, Code, HStack, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';

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
          message: `API respondió ${response.status}. Revisa PostgreSQL y Redis.`,
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
    <Box borderWidth="1px" borderRadius="lg" p={6}>
      <HStack justify="space-between" align="center" mb={4}>
        <Heading size="md">Estado de dependencias</Heading>
        <Button size="sm" onClick={() => void load()} isLoading={state.kind === 'loading'}>
          Reintentar
        </Button>
      </HStack>

      {state.kind === 'loading' && (
        <HStack>
          <Spinner size="sm" />
          <Text>Consultando readiness…</Text>
        </HStack>
      )}

      {state.kind === 'ready' && (
        <Stack spacing={2}>
          <HStack>
            <Badge colorScheme="green">API ready</Badge>
            <Text fontSize="sm" color="gray.600">
              {state.data.timestamp}
            </Text>
          </HStack>
          <Text>
            PostgreSQL: <Badge>{state.data.checks?.database ?? 'unknown'}</Badge>
          </Text>
          <Text>
            Redis: <Badge>{state.data.checks?.redis ?? 'unknown'}</Badge>
          </Text>
        </Stack>
      )}

      {state.kind === 'unavailable' && (
        <Stack spacing={2}>
          <Badge colorScheme="red" width="fit-content">
            API not ready
          </Badge>
          <Text>{state.message}</Text>
        </Stack>
      )}
    </Box>
  );
}
