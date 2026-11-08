import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RedisModule } from './redis/redis.module';
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
    HealthModule,
    AuthModule,
    TenancyModule,
    IdentityModule,
    PropertiesModule,
    AuditModule,
  ],
})
export class AppModule {}
