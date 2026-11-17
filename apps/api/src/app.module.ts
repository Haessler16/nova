import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CsrfGuard } from './auth/csrf.guard';
import { DocumentsModule } from './documents/documents.module';
import { ExportsModule } from './exports/exports.module';
import { validateEnv } from './config/env.validation';
import { FrontOfficeModule } from './front-office/front-office.module';
import { FolioModule } from './folio/folio.module';
import { GuestsModule } from './guests/guests.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InstructionsModule } from './instructions/instructions.module';
import { InventoryModule } from './inventory/inventory.module';
import { NightAuditModule } from './night-audit/night-audit.module';
import { ObservabilityModule } from './observability/observability.module';
import { PilotModule } from './pilot/pilot.module';
import { PrismaModule } from './prisma/prisma.module';
import { MutationRateLimitGuard } from './rate-limit/mutation-rate-limit.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { PropertiesModule } from './properties/properties.module';
import { ReportsModule } from './reports/reports.module';
import { RedisModule } from './redis/redis.module';
import { ReservationsModule } from './reservations/reservations.module';
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
    RateLimitModule,
    ObservabilityModule,
    SecurityEventsModule,
    HealthModule,
    AuthModule,
    AdminModule,
    TenancyModule,
    IdentityModule,
    PropertiesModule,
    InventoryModule,
    GuestsModule,
    ReservationsModule,
    InstructionsModule,
    FrontOfficeModule,
    DocumentsModule,
    FolioModule,
    CatalogModule,
    NightAuditModule,
    ReportsModule,
    ExportsModule,
    PilotModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MutationRateLimitGuard,
    },
  ],
})
export class AppModule {}
