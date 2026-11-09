'use client';

import { Box, HStack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

type ConnectionState = 'online' | 'offline';

/**
 * Real browser connectivity indicator. It intentionally does not fake a
 * "syncing" state: the API has no global synchronization channel yet.
 */
export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<ConnectionState>('online');

  useEffect(() => {
    function update(): void {
      setState(navigator.onLine ? 'online' : 'offline');
    }

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const online = state === 'online';

  return (
    <HStack
      spacing={2}
      px={compact ? 2 : 2.5}
      py={1}
      borderRadius="full"
      bg={online ? 'mint.50' : 'danger.50'}
      color={online ? 'mint.800' : 'danger.700'}
      borderWidth="1px"
      borderColor={online ? 'mint.100' : 'danger.100'}
      role="status"
      aria-live="polite"
    >
      <Box
        boxSize="7px"
        borderRadius="full"
        bg={online ? 'mint.500' : 'danger.500'}
        boxShadow={online ? '0 0 0 3px rgba(72, 201, 165, 0.18)' : 'none'}
      />
      <Text fontSize="xs" fontWeight="semibold" whiteSpace="nowrap">
        {online ? 'En línea' : 'Sin conexión'}
      </Text>
    </HStack>
  );
}
