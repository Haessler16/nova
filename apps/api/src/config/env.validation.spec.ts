import 'reflect-metadata';
import { validateEnv } from './env.validation';

const baseline = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/nova',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_MODE: 'dev-header',
  CORS_ORIGINS: 'http://localhost:3000',
};

const production = {
  ...baseline,
  NODE_ENV: 'production',
  AUTH_MODE: 'local-session',
  CSRF_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_DELIVERY: 'none',
};

describe('validateEnv', () => {
  it('accepts the local development baseline', () => {
    expect(() => validateEnv({ ...baseline })).not.toThrow();
  });

  it('refuses to boot production with AUTH_MODE=dev-header', () => {
    expect(() => validateEnv({ ...production, AUTH_MODE: 'dev-header' })).toThrow(
      /dev-header is forbidden/i,
    );
  });

  it('rejects a wildcard CORS origin', () => {
    expect(() => validateEnv({ ...baseline, CORS_ORIGINS: '*,http://localhost:3000' })).toThrow(
      /wildcard/i,
    );
  });

  it('requires a metrics token when metrics are enabled in production', () => {
    expect(() => validateEnv({ ...production, METRICS_ENABLED: 'true' })).toThrow(/METRICS_TOKEN/);
  });

  it('allows metrics in production when a token is configured', () => {
    expect(() =>
      validateEnv({
        ...production,
        METRICS_ENABLED: 'true',
        METRICS_TOKEN: 'a'.repeat(32),
      }),
    ).not.toThrow();
  });

  it('allows metrics to stay disabled in production', () => {
    expect(() => validateEnv({ ...production, METRICS_ENABLED: 'false' })).not.toThrow();
  });
});
