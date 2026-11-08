import type { Request } from 'express';

/**
 * Minimal RFC-6265 cookie parser. The API only needs a couple of opaque,
 * URL-safe cookie values, so a dependency is not justified.
 */
export function parseCookies(request: Pick<Request, 'headers'>): Record<string, string> {
  const header = request.headers.cookie;
  if (header === undefined || header.length === 0) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      continue;
    }

    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      // Malformed percent-encoding is not an authentication failure signal;
      // the cookie is simply ignored.
    }
  }

  return cookies;
}

export function readCookie(request: Pick<Request, 'headers'>, name: string): string | undefined {
  return parseCookies(request)[name];
}
