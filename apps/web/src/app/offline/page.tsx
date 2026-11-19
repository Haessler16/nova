import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, translate, type TranslationKey } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
  return { title: translate(locale, 'offline.metadataTitle') };
}

export default function OfflinePage() {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
  const t = (key: TranslationKey): string => translate(locale, key);

  return (
    <main
      id="main-content"
      lang={locale}
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        background: '#f7f8fa',
        color: '#1a202c',
      }}
    >
      <section
        aria-labelledby="offline-title"
        style={{
          maxWidth: '480px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <h1 id="offline-title" style={{ fontSize: '24px', marginBottom: '12px' }}>
          {t('offline.title')}
        </h1>
        <p style={{ color: '#4a5568', lineHeight: 1.6, marginBottom: '20px' }}>
          {t('offline.body')}
        </p>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#1a365d',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t('offline.retry')}
        </a>
      </section>
    </main>
  );
}
