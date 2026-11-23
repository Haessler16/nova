import { Injectable } from '@nestjs/common';
import { Clock } from '../common/time/clock';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface VersionInfo {
  status: 'ok';
  version: string;
  commit: string | null;
  environment: string;
  node: string;
  uptimeSeconds: number;
  timezone: string;
  database: {
    reachable: boolean;
    latestMigration: string | null;
  };
}

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
    private readonly clock: Clock,
  ) {}

  liveness(): HealthCheckResult {
    return { status: 'ok', timestamp: this.clock.now().toISOString() };
  }

  /**
   * Non-sensitive build/schema diagnostics for support and future Edge
   * installations. It never exposes connection strings, secrets or row data.
   */
  async version(): Promise<VersionInfo> {
    let database: VersionInfo['database'] = { reachable: false, latestMigration: null };

    try {
      const rows = await this.prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `;
      database = { reachable: true, latestMigration: rows[0]?.migration_name ?? null };
    } catch {
      // Keep diagnostics available when the database is down; the client only
      // needs to know that the latest migration could not be read.
    }

    return {
      status: 'ok',
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? 'unknown',
      commit: process.env.GIT_COMMIT ?? process.env.GITHUB_SHA ?? null,
      environment: process.env.NODE_ENV ?? 'development',
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      database,
    };
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
      timestamp: this.clock.now().toISOString(),
      checks,
    };
  }
}
