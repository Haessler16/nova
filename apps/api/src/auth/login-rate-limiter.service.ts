import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

export interface RateLimitDecision {
  limited: boolean;
  retryAfterSeconds?: number;
}

/**
 * Fixed-window login limiter keyed by a hash of client IP + normalized email.
 * No raw email or IP is stored in Redis. If Redis is unavailable the limiter
 * fails open and logs a warning: availability of login must not depend on an
 * auxiliary service, while PostgreSQL remains the authentication authority.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly logger = new Logger(LoginRateLimiter.name);
  private readonly max: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.max = config.get<number>('LOGIN_RATE_LIMIT_MAX', 10);
    this.windowSeconds = config.get<number>('LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900);
  }

  async check(ip: string, email: string): Promise<RateLimitDecision> {
    const identity = createHash('sha256')
      .update(`${ip}|${email.trim().toLowerCase()}`, 'utf8')
      .digest('hex');
    const count = await this.redis.incrementWindow(
      `nova:auth:login:${identity}`,
      this.windowSeconds,
    );

    if (count === null) {
      this.logger.warn('Login rate limiter degraded: Redis unavailable, allowing attempt.');
      return { limited: false };
    }

    if (count > this.max) {
      return { limited: true, retryAfterSeconds: this.windowSeconds };
    }

    return { limited: false };
  }
}
