'use client';

import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker';
import { SessionProvider } from '@/context/session';
import { I18nProvider, type Locale } from '@/lib/i18n';
import theme from '@/theme';

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <I18nProvider locale={locale}>
        <SessionProvider>
          <ServiceWorkerRegistration />
          {children}
        </SessionProvider>
      </I18nProvider>
    </ChakraProvider>
  );
}
