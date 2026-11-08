import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { AuthenticatedRequest, CORRELATION_ID_HEADER } from './request-context';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Accepts a well-formed caller correlation id or generates one. The value is
 * never used for authorization, only for structured tracing.
 */
export function correlationIdMiddleware(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(CORRELATION_ID_HEADER);
  const correlationId =
    incoming !== undefined && SAFE_CORRELATION_ID.test(incoming) ? incoming : randomUUID();

  request.correlationId = correlationId;
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
