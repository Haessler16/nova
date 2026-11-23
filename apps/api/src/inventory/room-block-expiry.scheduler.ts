import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../common/time/clock';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStateService } from './room-state.service';

const ADVISORY_LOCK_KEY_1 = 0x4e4f5641; // "NOVA"
const ADVISORY_LOCK_KEY_2 = 0x52424558; // "RBEX" (room-block expiry)

export interface ExpiryRunResult {
  skipped: boolean;
  properties: number;
  expiredBlocks: number;
}

/**
 * Background expiry for room blocks. PostgreSQL remains authoritative:
 * - reconciliation uses transactions, row locks and the existing exclusion/history logic;
 * - an advisory lock prevents concurrent schedulers from duplicating work;
 * - lazy reconciliation on reads still works if the scheduler is disabled.
 */
@Injectable()
export class RoomBlockExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomBlockExpiryScheduler.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomState: RoomStateService,
    private readonly metrics: MetricsService,
    private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('ROOM_BLOCK_EXPIRY_ENABLED', true);
    this.intervalMs = config.get<number>('ROOM_BLOCK_EXPIRY_INTERVAL_SECONDS', 60) * 1000;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Room block expiry scheduler disabled by configuration.');
      return;
    }
    if (process.env.NODE_ENV === 'test') {
      // Tests call runOnce() explicitly to keep timing deterministic.
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce('interval');
    }, this.intervalMs);
    this.timer.unref?.();
    this.logger.log(
      `Room block expiry scheduler started (every ${Math.round(this.intervalMs / 1000)}s).`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(trigger = 'manual'): Promise<ExpiryRunResult> {
    if (this.running) {
      return { skipped: true, properties: 0, expiredBlocks: 0 };
    }

    this.running = true;
    const startedAt = this.clock.now().getTime();
    try {
      const locked = await this.tryAdvisoryLock();
      if (!locked) {
        this.metrics.incrementCounter('nova_room_block_expiry_runs_total', {
          result: 'lock_skipped',
        });
        return { skipped: true, properties: 0, expiredBlocks: 0 };
      }

      try {
        const now = this.clock.now();
        const candidates = await this.prisma.roomBlock.findMany({
          where: { status: 'ACTIVE', endsAt: { lte: now } },
          distinct: ['organizationId', 'propertyId'],
          select: { organizationId: true, propertyId: true },
          take: 500,
        });

        let expiredBlocks = 0;
        for (const candidate of candidates) {
          const before = await this.countExpiredActive(candidate, now);
          await this.roomState.reconcileProperty({
            organizationId: candidate.organizationId,
            propertyId: candidate.propertyId,
            correlationId: `room-block-expiry:${trigger}:${now.toISOString()}`,
          });
          expiredBlocks += before;
        }

        this.metrics.incrementCounter('nova_room_block_expiry_runs_total', {
          result: 'success',
        });
        this.metrics.incrementCounter('nova_room_block_expiry_blocks_total', {}, expiredBlocks);
        this.logger.log(
          `Room block expiry (${trigger}): ${expiredBlocks} block(s) reconciled across ${candidates.length} propert${candidates.length === 1 ? 'y' : 'ies'} in ${this.clock.now().getTime() - startedAt}ms.`,
        );
        return { skipped: false, properties: candidates.length, expiredBlocks };
      } finally {
        await this.releaseAdvisoryLock();
      }
    } catch (error) {
      this.metrics.incrementCounter('nova_room_block_expiry_runs_total', {
        result: 'error',
      });
      this.logger.error(
        `Room block expiry failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { skipped: false, properties: 0, expiredBlocks: 0 };
    } finally {
      this.running = false;
    }
  }

  private async countExpiredActive(
    scope: { organizationId: string; propertyId: string },
    now: Date,
  ): Promise<number> {
    return this.prisma.roomBlock.count({
      where: {
        organizationId: scope.organizationId,
        propertyId: scope.propertyId,
        status: 'ACTIVE',
        endsAt: { lte: now },
      },
    });
  }

  private async tryAdvisoryLock(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY_1}::int, ${ADVISORY_LOCK_KEY_2}::int) AS locked
    `;
    return rows[0]?.locked === true;
  }

  private async releaseAdvisoryLock(): Promise<void> {
    await this.prisma.$queryRaw`
      SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY_1}::int, ${ADVISORY_LOCK_KEY_2}::int)
    `;
  }
}
