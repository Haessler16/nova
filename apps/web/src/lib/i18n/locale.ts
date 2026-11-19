/**
 * Supported UI locales for NOVA PMS.
 *
 * `pt-BR` is the priority language for reception (Fase 7). `es` is kept because
 * the app shipped in Spanish and the pilot still operates in it. The active
 * locale is read from the `nova_locale` cookie; a value that is not in this list
 * falls back to `DEFAULT_LOCALE`, so a stale cookie can never break rendering.
 */

export const LOCALES = ['es', 'pt-BR'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export const LOCALE_COOKIE = 'nova_locale';

/** BCP-47 tag for `Intl` date/number formatting (es-AR keeps current output). */
export const INTL_LOCALE: Record<Locale, string> = {
  es: 'es-AR',
  'pt-BR': 'pt-BR',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return value !== null && value !== undefined && isLocale(value) ? value : DEFAULT_LOCALE;
}
