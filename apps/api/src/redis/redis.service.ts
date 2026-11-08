import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const READINESS_TIMEOUT_MS = 2500;

/**
 * Redis is auxiliary: readiness, future cache and ephemeral coordination.
 * It is NEVER used here (or elsewhere) as the authority for business integrity.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => (attempt > 2 ? null : Math.min(attempt * 200, 1000)),
    });

    // ioredis emits `error` on connection failures; without a listener Node
    // would treat it as an unhandled error. Readiness reports the failure.
    this.client.on('error', (error: Error) => {
      this.logger.debug(`Redis connection error: ${error.message}`);
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.withTimeout(this.ping());
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Fixed-window counter used for authentication abuse limiting. Redis is
   * auxiliary here: if it is unavailable the caller decides how to degrade.
   */
  async incrementWindow(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect();
      }

      const count = await this.withTimeout(this.client.incr(key));
      if (count === 1) {
        await this.withTimeout(this.client.expire(key, ttlSeconds));
      }
      return count;
    } catch (error) {
      this.logger.warn(
        `Redis rate-limit increment failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status !== 'end') {
        await this.client.quit();
      }
    } catch {
      this.client.disconnect();
    }
  }

  private async ping(): Promise<string> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
    return this.client.ping();
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Redis readiness timed out')),
        READINESS_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}
