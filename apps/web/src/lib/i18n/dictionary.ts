import { es } from './es';
import { ptBR } from './pt-BR';
import type { Locale } from './locale';

/**
 * Minimal, dependency-free i18n core.
 *
 * The app had no i18n layer: every label was a Spanish literal inside a screen.
 * Fase 7 introduces one dictionary per locale and a `t()` contract, so a screen
 * migrates by replacing literals with keys instead of importing a framework.
 * No runtime is added because the current needs (static dictionaries, one active
 * locale per session, `Intl` formatting) do not require ICU, plurals or lazy
 * loading yet.
 */

export type TranslationKey = keyof typeof es;

export type TranslationVars = Record<string, string | number>;

export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  es,
  'pt-BR': ptBR,
};

/**
 * Looks up `key` for `locale` and interpolates `{placeholders}`.
 * Missing entries fall back to Spanish, then to the key itself, so a
 * half-migrated screen stays readable instead of rendering `undefined`.
 */
export function translate(locale: Locale, key: TranslationKey, vars?: TranslationVars): string {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES.es[key] ?? key;
  if (vars === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
