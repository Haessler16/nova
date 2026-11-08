import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  checks?: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  liveness(): HealthCheckResult {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async readiness(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.allSettled([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const checks = {
      database: database.status === 'fulfilled' && database.value ? 'up' : 'down',
      redis: redis.status === 'fulfilled' && redis.value ? 'up' : 'down',
    } as const;

    const healthy = checks.database === 'up' && checks.redis === 'up';

    return {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
