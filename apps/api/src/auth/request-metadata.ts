import type { Request } from 'express';
import type { AuthenticatedRequest } from '../common/http/request-context';
import type { AuthRequestMetadata } from './auth.service';

/**
 * Extracts only the low-sensitivity request metadata used for security events
 * and session display. Raw IPs are hashed by the auth service before storage.
 */
export function authRequestMetadata(request: Request): AuthRequestMetadata {
  return {
    ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
    userAgent: request.header('user-agent'),
    correlationId: (request as AuthenticatedRequest).correlationId,
  };
}
