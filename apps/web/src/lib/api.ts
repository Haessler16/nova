import type { Actor, AuthMode } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const DEV_USER_STORAGE_KEY = 'nova.devUserId';

export interface TenantSelection {
  organizationId?: string | null;
  propertyId?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  tenant?: TenantSelection;
  /** Bootstrap probes should not log the user out on a 401. */
  suppressAuthEvent?: boolean;
}

let authMode: AuthMode | null = null;
let csrfToken: string | null = null;
let devUserId: string | null = null;
let devUserLoaded = false;

function readDevUser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!devUserLoaded) {
    devUserId = window.localStorage.getItem(DEV_USER_STORAGE_KEY);
    devUserLoaded = true;
  }
  return devUserId;
}

export function getDevUserId(): string | null {
  return readDevUser();
}

export function setDevUserId(userId: string | null): void {
  devUserId = userId;
  devUserLoaded = true;
  if (typeof window !== 'undefined') {
    if (userId === null) {
      window.localStorage.removeItem(DEV_USER_STORAGE_KEY);
    } else {
      window.localStorage.setItem(DEV_USER_STORAGE_KEY, userId);
    }
  }
}

export function getAuthMode(): AuthMode | null {
  return authMode;
}

export function setAuthMode(mode: AuthMode | null): void {
  authMode = mode;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nova:unauthorized'));
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let code = `http_${response.status}`;
  let message = `La API respondió ${response.status}.`;
  let details: unknown;
  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string | string[];
      details?: unknown;
    };
    if (typeof body.code === 'string') {
      code = body.code;
    }
    if (typeof body.message === 'string') {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      message = body.message.join(', ');
    }
    details = body.details;
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  return new ApiError(response.status, code, message, details);
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken !== null) {
    return csrfToken;
  }
  const response = await fetch(`${API_URL}/api/v1/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

/**
 * Single fetch wrapper for the API: opaque session cookie, CSRF header for
 * local-session writes, optional dev-header identity and validated tenant
 * selectors. The backend remains the authorization authority.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  // Phase 7 has no write outbox: block mutations explicitly while offline so a
  // critical operation is never shown as committed without reaching the API.
  if (method !== 'GET' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(
      0,
      'offline',
      'Sin conexión: la operación no se envió. Reintentá cuando vuelvas a estar en línea.',
    );
  }

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.tenant?.organizationId !== undefined && options.tenant.organizationId !== null) {
    headers['X-Organization-Id'] = options.tenant.organizationId;
  }
  if (options.tenant?.propertyId !== undefined && options.tenant.propertyId !== null) {
    headers['X-Property-Id'] = options.tenant.propertyId;
  }

  const currentDevUser = readDevUser();
  if (currentDevUser !== null) {
    headers['X-Dev-User-Id'] = currentDevUser;
  }

  if (method !== 'GET' && authMode === 'local-session') {
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 401 && options.suppressAuthEvent !== true) {
    notifyUnauthorized();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function downloadCsv(
  path: string,
  tenant: TenantSelection,
  filename: string,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(
      0,
      'offline',
      'Sin conexión: no se puede descargar la exportación. Reintentá cuando vuelvas a estar en línea.',
    );
  }

  const headers: Record<string, string> = { Accept: 'text/csv' };
  if (tenant.organizationId !== undefined && tenant.organizationId !== null) {
    headers['X-Organization-Id'] = tenant.organizationId;
  }
  if (tenant.propertyId !== undefined && tenant.propertyId !== null) {
    headers['X-Property-Id'] = tenant.propertyId;
  }
  const currentDevUser = readDevUser();
  if (currentDevUser !== null) {
    headers['X-Dev-User-Id'] = currentDevUser;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401) {
    notifyUnauthorized();
  }
  if (!response.ok) {
    throw await parseError(response);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchAuthMode(): Promise<AuthMode> {
  const response = await fetch(`${API_URL}/api/v1/auth/mode`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const body = (await response.json()) as { authMode: AuthMode };
  authMode = body.authMode;
  return body.authMode;
}

export interface SessionInfo {
  user: Actor;
  authentication: 'local-session' | 'dev-header';
}

export interface LocalLoginResult {
  kind: 'session' | 'mfa';
  user?: Actor;
  expiresAt?: string;
  challengeToken?: string;
  csrfToken?: string;
}

export async function loginLocal(
  email: string,
  password: string,
  mfaCode?: string,
): Promise<LocalLoginResult> {
  const token = await ensureCsrfToken();
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, password, ...(mfaCode !== undefined ? { mfaCode } : {}) }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as {
    mfaRequired?: boolean;
    challengeToken?: string;
    expiresAt?: string;
    user?: Actor;
    csrfToken?: string;
  };

  if (body.mfaRequired === true && body.challengeToken !== undefined) {
    return {
      kind: 'mfa',
      challengeToken: body.challengeToken,
      expiresAt: body.expiresAt,
    };
  }

  if (body.csrfToken !== undefined) {
    csrfToken = body.csrfToken;
  }
  const session = await api<SessionInfo>('/api/v1/auth/session', { suppressAuthEvent: true });
  setDevUserId(null);
  authMode = session.authentication;
  return { kind: 'session', user: session.user, csrfToken: body.csrfToken };
}

export async function completeMfaLogin(challengeToken: string, code: string): Promise<SessionInfo> {
  const token = await ensureCsrfToken();
  const response = await fetch(`${API_URL}/api/v1/auth/login/mfa`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ challengeToken, code }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { csrfToken?: string };
  if (body.csrfToken !== undefined) {
    csrfToken = body.csrfToken;
  }
  return api<SessionInfo>('/api/v1/auth/session', { suppressAuthEvent: true });
}

export async function logoutSession(): Promise<void> {
  try {
    await api<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    setDevUserId(null);
    csrfToken = null;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
