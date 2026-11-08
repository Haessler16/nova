import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
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

  @IsIn(['dev-header', 'disabled'])
  AUTH_MODE: 'dev-header' | 'disabled' = 'dev-header';

  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:3000';

  @Type(() => Number)
  @IsInt()
  @Min(1024)
  @Max(8192)
  AUDIT_METADATA_MAX_BYTES = 8192;
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

  return validated;
}
