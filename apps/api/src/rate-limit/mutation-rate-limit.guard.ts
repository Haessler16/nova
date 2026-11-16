import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MutationRateLimiter } from './mutation-rate-limiter.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global guard applied after CSRF validation. Safe methods are never counted,
 * so `GET` traffic (dashboards, polling, reports) is unaffected.
 */
@Injectable()
export class MutationRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: MutationRateLimiter) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const decision = await this.limiter.check(request);
    if (!decision.limited) {
      return true;
    }

    const response = context.switchToHttp().getResponse<Response>();
    if (decision.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(decision.retryAfterSeconds));
    }

    throw new HttpException(
      {
        code: 'rate_limited',
        message: 'Too many mutation requests. Please retry later.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
