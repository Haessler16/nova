import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ORGANIZATION_HEADER, PROPERTY_HEADER } from '../common/http/request-context';
import { RedisService } from '../redis/redis.service';

export interface MutationRateLimitDecision {
  limited: boolean;
  retryAfterSeconds?: number;
}

const TENANT_ID_PATTERN = /^[0-9a-fA-F-]{36}$/;

/**
 * Fixed-window limiter for mutating requests.
 *
 * Two counters are evaluated for every POST/PUT/PATCH/DELETE:
 * - `ip`: the client address, a coarse anti-abuse cap for a single origin;
 * - `tenant`: the organization/property selectors, so one tenant sharing a
 *   NAT/proxy address does not consume another tenant's budget.
 *
 * Redis only coordinates the window. Authorization, integrity and idempotency
 * stay in PostgreSQL. If Redis is unavailable the limiter fails open and logs a
 * warning: an auxiliary dependency must not take the whole API down.
 */
@Injectable()
export class MutationRateLimiter {
  private readonly enabled: boolean;
  private readonly max: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('MUTATION_RATE_LIMIT_ENABLED', true);
    this.max = config.get<number>('MUTATION_RATE_LIMIT_MAX', 600);
    this.windowSeconds = config.get<number>('MUTATION_RATE_LIMIT_WINDOW_SECONDS', 60);
  }

  async check(request: Request): Promise<MutationRateLimitDecision> {
    if (!this.enabled) {
      return { limited: false };
    }

    for (const window of this.windowsFor(request)) {
      const count = await this.redis.incrementWindow(
        `nova:rl:mutation:${window.scope}:${hash(window.value)}`,
        this.windowSeconds,
      );

      if (count !== null && count > this.max) {
        return { limited: true, retryAfterSeconds: this.windowSeconds };
      }
    }

    return { limited: false };
  }

  private windowsFor(request: Request): Array<{ scope: 'ip' | 'tenant'; value: string }> {
    const windows: Array<{ scope: 'ip' | 'tenant'; value: string }> = [
      { scope: 'ip', value: clientIp(request) },
    ];

    const organizationId = headerValue(request, ORGANIZATION_HEADER);
    const propertyId = headerValue(request, PROPERTY_HEADER);

    // Only well-formed selectors are bucketed; arbitrary strings would let a
    // client create unbounded Redis keys. Authorization never trusts them.
    if (organizationId !== undefined && TENANT_ID_PATTERN.test(organizationId)) {
      const tenant =
        propertyId !== undefined && TENANT_ID_PATTERN.test(propertyId)
          ? `${organizationId}|${propertyId}`
          : organizationId;
      windows.push({ scope: 'tenant', value: tenant });
    }

    return windows;
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.header(name);
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
