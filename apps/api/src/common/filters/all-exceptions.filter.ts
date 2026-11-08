import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../http/request-context';

const DEFAULT_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  422: 'business_rule_violation',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'service_unavailable',
};

interface ErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  details?: unknown;
}

/**
 * Uniform error envelope. Never leaks Prisma/database internals or request
 * bodies to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();

    let status = 500;
    let code = 'internal_error';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'http_error';
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (body !== null && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        const rawMessage = record.message;

        if (Array.isArray(rawMessage)) {
          message = 'Validation failed.';
          details = rawMessage;
          code = status === 400 ? 'validation_failed' : code;
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }

        if (typeof record.code === 'string') {
          code = record.code;
        }
        if (record.details !== undefined) {
          details = record.details;
        }
      }
    } else {
      this.logger.error({
        message: exception instanceof Error ? exception.message : 'Unknown error',
        correlationId: request.correlationId,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    const payload: ErrorBody = {
      code,
      message,
      correlationId: request.correlationId,
      ...(details !== undefined ? { details } : {}),
    };

    if (!response.headersSent) {
      response.status(status).json(payload);
    }
  }
}
