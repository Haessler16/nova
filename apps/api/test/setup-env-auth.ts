/**
 * Dedicated environment for cookie/session authentication E2E tests.
 * Requires the same local PostgreSQL/Redis and seeded data as the default
 * E2E suite.
 */
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'local-session';
process.env.CSRF_SECRET = 'nova-test-csrf-secret-0123456789abcdef0123456789abcdef';
process.env.LOGIN_RATE_LIMIT_MAX = '5';
process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS = '60';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://nova:nova_local_only@localhost:5432/nova_pms?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.AUDIT_METADATA_MAX_BYTES = process.env.AUDIT_METADATA_MAX_BYTES ?? '8192';
