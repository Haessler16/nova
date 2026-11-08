import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://nova:nova_local_only@localhost:5432/nova_pms?schema=public';
const runId = `e2e_${Date.now().toString(36)}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const schema = runId;
const databaseUrl = withSchema(baseUrl, schema);

function withSchema(url: string, schemaName: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schemaName);
  return parsed.toString();
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env,
  });
}

async function createSchema(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await admin.$disconnect();
  }
}

async function dropSchema(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error('Usage: ts-node scripts/run-e2e-isolated.ts -- <command> [args...]');
  }
  const separator = args.indexOf('--');
  const commandArgs = separator >= 0 ? args.slice(separator + 1) : args;
  if (commandArgs.length === 0) {
    throw new Error('Missing command after --');
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    E2E_SCHEMA: schema,
  };

  console.log(`[e2e] schema=${schema}`);
  await createSchema();
  try {
    run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], env);
    run('pnpm', ['exec', 'prisma', 'db', 'seed'], env);
    run(commandArgs[0], commandArgs.slice(1), env);
  } finally {
    try {
      await dropSchema();
      console.log(`[e2e] dropped schema=${schema}`);
    } catch (error) {
      console.error(
        `[e2e] failed to drop schema ${schema}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exitCode = process.exitCode ?? 1;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
