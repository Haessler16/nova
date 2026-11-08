import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AuthenticatedRequest } from '../common/http/request-context';
import { MetricsService } from './metrics.service';

/**
 * Structured, low-sensitivity request log plus HTTP metrics. Query strings and
 * request bodies are intentionally excluded: they can contain personal or
 * credential material. Path is truncated and normalized to bound cardinality.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    const method = request.method.toUpperCase();
    const path = normalizePath(request.originalUrl ?? request.url ?? '/');

    const finish = (error?: unknown): void => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const status = error === undefined ? response.statusCode : statusForError(error);
      const statusClass = `${Math.floor(status / 100)}xx`;

      this.metrics.incrementCounter('nova_http_requests_total', {
        method,
        status: String(status),
        status_class: statusClass,
      });
      this.metrics.observeHistogram(
        'nova_http_request_duration_seconds',
        durationSeconds,
        { method, path },
      );

      const line = JSON.stringify({
        event: 'http_request',
        method,
        path,
        status,
        durationMs: Math.round(durationSeconds * 1000),
        correlationId: request.correlationId,
        userId: request.actor?.id,
        organizationId: request.tenant?.organizationId,
        propertyId: request.tenant?.propertyId,
      });

      if (status >= 500) {
        this.logger.error(line);
      } else if (status >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => finish(),
        error: (error: unknown) => finish(error),
      }),
    );
  }
}

function normalizePath(raw: string): string {
  const path = raw.split('?')[0] ?? '/';
  return path.length > 200 ? `${path.slice(0, 200)}…` : path;
}

function statusForError(error: unknown): number {
  if (error !== null && typeof error === 'object' && 'getStatus' in error) {
    const getStatus = (error as { getStatus?: () => unknown }).getStatus;
    if (typeof getStatus === 'function') {
      const status = getStatus.call(error);
      if (typeof status === 'number') {
        return status;
      }
    }
  }
  return 500;
}
