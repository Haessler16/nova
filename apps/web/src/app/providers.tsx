'use client';

import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/context/session';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider>
      <SessionProvider>{children}</SessionProvider>
    </ChakraProvider>
  );
}
