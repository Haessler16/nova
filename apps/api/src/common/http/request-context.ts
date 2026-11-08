import type { Request } from 'express';

export interface AuthenticatedActor {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface TenantContext {
  readonly organizationId: string;
  readonly propertyId?: string;
  readonly organizationRoleId?: string;
  readonly propertyRoleId?: string;
  readonly actor: AuthenticatedActor;
  /** Union of organization-level and property-level permissions. */
  readonly permissions: ReadonlySet<string>;
  /** Permissions granted by the organization membership role only. */
  readonly organizationPermissions: ReadonlySet<string>;
  readonly correlationId: string;
}

/**
 * Express request augmented by CorrelationIdMiddleware, AuthenticationGuard and
 * TenantContextGuard. Populated only on the server.
 */
export interface AuthenticatedRequest extends Request {
  correlationId?: string;
  actor?: AuthenticatedActor;
  sessionId?: string;
  tenant?: TenantContext;
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const DEV_USER_HEADER = 'x-dev-user-id';
export const ORGANIZATION_HEADER = 'x-organization-id';
export const PROPERTY_HEADER = 'x-property-id';
export const CSRF_HEADER = 'x-csrf-token';

export const SESSION_COOKIE_NAME = 'nova_session';
export const CSRF_COOKIE_NAME = 'nova_csrf';
