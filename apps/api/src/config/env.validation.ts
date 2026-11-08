import { plainToInstance, Type } from 'class-transformer';
import {
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

  return validated;
}
