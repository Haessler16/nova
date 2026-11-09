'use client';

import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker';
import { SessionProvider } from '@/context/session';
import theme from '@/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <SessionProvider>
        <ServiceWorkerRegistration />
        {children}
      </SessionProvider>
    </ChakraProvider>
  );
}
