import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { TranslationKey } from './dictionary';
import { translate } from './dictionary';
import { LOCALE_COOKIE, resolveLocale } from './locale';

/**
 * Tab metadata for one route segment. Next resolves `generateMetadata` per
 * segment, so each segment layout still owns a file; this factory removes the
 * repeated body and keeps the locale resolution in one place.
 *
 * Import it directly from server files; never from the `@/lib/i18n` barrel,
 * which pulls in the client provider and cannot bundle `next/headers`.
 */
export function segmentMetadata(titleKey: TranslationKey): () => Promise<Metadata> {
  return async () => {
    const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
    return { title: translate(locale, titleKey) };
  };
}
