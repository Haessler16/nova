import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * First version of the isolated demo sandbox.
 *
 * It provisions a dedicated PostgreSQL schema (`demo_sandbox`) with the same
 * migrations and synthetic seed used by development, so pilot demos never
 * touch the working schema. It refuses non-local databases and requires an
 * explicit confirmation flag.
 */
const SANDBOX_SCHEMA = 'demo_sandbox';
const FALLBACK_URL = 'postgresql://nova:nova_local_only@localhost:5432/nova_pms';
const databaseUrl = process.env.DATABASE_URL ?? FALLBACK_URL;

function looksLocal(url: string): boolean {
  return /(localhost|127\.0\.0\.1|nova-postgres)/.test(url);
}

if (!looksLocal(databaseUrl)) {
  console.error('Refusing demo sandbox: DATABASE_URL does not look local.');
  process.exit(2);
}

if (process.env.CONFIRM_DEMO_SANDBOX !== '1') {
  console.error(
    'Set CONFIRM_DEMO_SANDBOX=1 to create or refresh the isolated demo sandbox schema.',
  );
  process.exit(2);
}

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
}

async function main(): Promise<void> {
  const sandboxUrl = withSchema(databaseUrl, SANDBOX_SCHEMA);

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SANDBOX_SCHEMA}"`);
  } finally {
    await prisma.$disconnect();
  }

  execFileSync('pnpm', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: 'inherit',
  });

  execFileSync('pnpm', ['db:seed'], {
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: 'inherit',
  });

  console.log('Demo sandbox ready: isolated PostgreSQL schema with synthetic data.');
  console.log(`DATABASE_URL=${sandboxUrl}`);
  console.log('Demo password for every synthetic user: NovaDemo!2026');
  console.log('Admin:     admin@demo.nova.local     -> 00000000-0000-4000-8000-000000000011');
  console.log('Reception: reception@demo.nova.local -> 00000000-0000-4000-8000-000000000012');
  console.log('Stop using this schema by pointing DATABASE_URL back at the working schema.');
}

main().catch((error: unknown) => {
  console.error('Demo sandbox failed:', error);
  process.exitCode = 1;
});
