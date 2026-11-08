/**
 * Deterministic local/test environment. The E2E suite expects the local
 * docker-compose PostgreSQL/Redis plus `pnpm db:reset` (migrate + seed).
 * It never uses production credentials and never targets a remote host.
 */
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'dev-header';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://nova:nova_local_only@localhost:5432/nova_pms?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.AUDIT_METADATA_MAX_BYTES = process.env.AUDIT_METADATA_MAX_BYTES ?? '8192';
