import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { LOCALE_COOKIE, resolveLocale, translate } from '@/lib/i18n';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Metadata follows the same cookie as the UI: no copy is hardcoded in a single
// language here either.
export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
  return {
    title: translate(locale, 'app.metadata.title'),
    description: translate(locale, 'app.metadata.description'),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Resolved on the server so `lang`, the provider and the first client render
  // agree; the cookie is only a preference, never authorization.
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} className={inter.variable}>
      <body className={inter.className}>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
