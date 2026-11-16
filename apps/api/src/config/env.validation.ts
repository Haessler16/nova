import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  API_PORT = 3001;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a PostgreSQL connection string',
  })
  DATABASE_URL!: string;

  @IsString()
  @Matches(/^rediss?:\/\//, { message: 'REDIS_URL must be a redis:// or rediss:// URL' })
  REDIS_URL = 'redis://localhost:6379';

  @IsIn(['dev-header', 'local-session', 'disabled'])
  AUTH_MODE: 'dev-header' | 'local-session' | 'disabled' = 'dev-header';

  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:3000';

  @Type(() => Number)
  @IsInt()
  @Min(1024)
  @Max(8192)
  AUDIT_METADATA_MAX_BYTES = 8192;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  SESSION_TTL_HOURS = 8;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/, {
    message: 'SESSION_COOKIE_NAME must contain 3-64 letters, digits, hyphens or underscores',
  })
  SESSION_COOKIE_NAME = 'nova_session';

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/, {
    message: 'CSRF_COOKIE_NAME must contain 3-64 letters, digits, hyphens or underscores',
  })
  CSRF_COOKIE_NAME = 'nova_csrf';

  /**
   * Required when AUTH_MODE=local-session. Used to HMAC-sign CSRF tokens.
   * Never commit a real value; production must provide it from a secret store.
   */
  @IsString()
  @IsOptional()
  @MinLength(32)
  CSRF_SECRET?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  LOGIN_RATE_LIMIT_MAX = 10;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(86400)
  LOGIN_RATE_LIMIT_WINDOW_SECONDS = 900;

  /**
   * Key material for encrypting TOTP shared secrets at rest and signing the
   * short-lived MFA challenge token. Required to enroll/enable MFA.
   */
  @IsString()
  @IsOptional()
  @MinLength(32)
  MFA_ENCRYPTION_KEY?: string;

  @IsString()
  @IsOptional()
  MFA_ISSUER = 'NOVA PMS';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  ACCOUNT_LOCKOUT_THRESHOLD = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  ACCOUNT_LOCKOUT_MINUTES = 15;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  PASSWORD_RESET_TTL_MINUTES = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  EMAIL_VERIFICATION_TTL_HOURS = 24;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  MFA_CHALLENGE_TTL_SECONDS = 300;

  /**
   * `log` writes development tokens to the API log; `response` returns them
   * in JSON for automated tests. Both are rejected in production, where an
   * email provider must deliver the one-time link.
   */
  @IsIn(['log', 'response', 'none'])
  AUTH_TOKEN_DELIVERY: 'log' | 'response' | 'none' = 'log';

  @Transform(toBoolean)
  @IsBoolean()
  ROOM_BLOCK_EXPIRY_ENABLED = true;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(3600)
  ROOM_BLOCK_EXPIRY_INTERVAL_SECONDS = 60;

  @Transform(toBoolean)
  @IsBoolean()
  METRICS_ENABLED = true;

  @IsString()
  @IsOptional()
  @MinLength(16)
  METRICS_TOKEN?: string;
}

/**
 * Fails fast on invalid configuration and refuses to boot production with the
 * development header authenticator enabled.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  if (validated.NODE_ENV === 'production' && validated.AUTH_MODE === 'dev-header') {
    throw new Error(
      'AUTH_MODE=dev-header is forbidden when NODE_ENV=production. Configure a real identity provider first.',
    );
  }

  if (validated.AUTH_MODE === 'local-session' && validated.CSRF_SECRET === undefined) {
    throw new Error('CSRF_SECRET is required when AUTH_MODE=local-session.');
  }

  if (validated.NODE_ENV === 'production' && validated.AUTH_TOKEN_DELIVERY !== 'none') {
    throw new Error(
      'AUTH_TOKEN_DELIVERY must be none in production until an email provider is configured. One-time tokens must never be logged or returned in production.',
    );
  }

  if (validated.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
    throw new Error(
      'CORS_ORIGINS must list explicit origins. A wildcard origin is incompatible with credentialed sessions.',
    );
  }

  if (
    validated.NODE_ENV === 'production' &&
    validated.METRICS_ENABLED &&
    !validated.METRICS_TOKEN
  ) {
    throw new Error(
      'METRICS_ENABLED requires METRICS_TOKEN in production, or disable metrics explicitly.',
    );
  }

  return validated;
}
