/**
 * Public surface of the Fase 7 i18n layer.
 *
 * Import from `@/lib/i18n` in screens and components:
 *   const { t, locale, intlLocale } = useI18n();
 * Server components resolve the locale with `resolveLocale(cookies().get(LOCALE_COOKIE)?.value)`
 * and translate with `translate(locale, key, vars)`.
 */

export { DICTIONARIES, translate } from './dictionary';
export type { TranslationKey, TranslationVars } from './dictionary';
export {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  isLocale,
  resolveLocale,
} from './locale';
export type { Locale } from './locale';
export { I18nProvider, useI18n } from './provider';
export type { I18nValue } from './provider';
