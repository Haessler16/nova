'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate, type TranslationKey, type TranslationVars } from './dictionary';
import { INTL_LOCALE, type Locale } from './locale';

export interface I18nValue {
  locale: Locale;
  /** BCP-47 tag for `Intl` formatting (dates, money). */
  intlLocale: string;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The locale arrives resolved from the server layout (cookie `nova_locale`), so
 * server and client render the same language and hydration does not mismatch.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      intlLocale: INTL_LOCALE[locale],
      t: (key: TranslationKey, vars?: TranslationVars) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}
