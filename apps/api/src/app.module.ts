import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/csrf.guard';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InventoryModule } from './inventory/inventory.module';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RedisModule } from './redis/redis.module';
import { SecurityEventsModule } from './security-events/security-events.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // `pnpm --filter @nova/api dev` runs with apps/api as cwd; root `.env`
      // lives two levels up. Shell env vars always take precedence.
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env.local'),
        join(process.cwd(), '../../.env'),
      ],
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    ObservabilityModule,
    SecurityEventsModule,
    HealthModule,
    AuthModule,
    AdminModule,
    TenancyModule,
    IdentityModule,
    PropertiesModule,
    InventoryModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
