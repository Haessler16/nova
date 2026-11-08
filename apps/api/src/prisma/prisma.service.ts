import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (error) {
      // Do not crash the process: liveness must stay up while readiness reports
      // the database as down. Prisma reconnects on demand for later requests.
      this.logger.error(
        `Initial PostgreSQL connection failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Executes the cheapest possible query to verify the database is reachable. */
  async isHealthy(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
