import { HealthService } from './health.service';
import { FakeClock } from '../common/time/fake-clock';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

function buildService(databaseHealthy: boolean, redisHealthy: boolean): HealthService {
  const prisma = {
    isHealthy: jest.fn().mockResolvedValue(databaseHealthy),
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ migration_name: '20261109150000_phase7_guest_import' }]),
  } as unknown as PrismaService;
  const redis = {
    isHealthy: jest.fn().mockResolvedValue(redisHealthy),
  } as unknown as RedisService;

  return new HealthService(prisma, redis, new FakeClock('2026-11-22T12:00:00.000Z'));
}

describe('HealthService', () => {
  it('reports liveness without touching dependencies', () => {
    const service = buildService(true, true);
    expect(service.liveness().status).toBe('ok');
  });

  it('reports readiness when database and Redis are up', async () => {
    const result = await buildService(true, true).readiness();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ database: 'up', redis: 'up' });
  });

  it('fails readiness when any critical dependency is down', async () => {
    const result = await buildService(true, false).readiness();

    expect(result.status).toBe('error');
    expect(result.checks).toEqual({ database: 'up', redis: 'down' });
  });

  it('reports non-sensitive version and schema diagnostics', async () => {
    const result = await buildService(true, true).version();

    expect(result.status).toBe('ok');
    expect(result.version).toEqual(expect.any(String));
    expect(result.node).toBe(process.version);
    expect(result.database).toEqual({
      reachable: true,
      latestMigration: '20261109150000_phase7_guest_import',
    });
  });

  it('keeps version diagnostics available when the database is down', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db unavailable')),
    } as unknown as PrismaService;
    const redis = { isHealthy: jest.fn() } as unknown as RedisService;

    const result = await new HealthService(
      prisma,
      redis,
      new FakeClock('2026-11-22T12:00:00.000Z'),
    ).version();

    expect(result.status).toBe('ok');
    expect(result.database).toEqual({ reachable: false, latestMigration: null });
  });

  it('reports database failures as down instead of throwing', async () => {
    const prisma = {
      isHealthy: jest.fn().mockRejectedValue(new Error('db unavailable')),
    } as unknown as PrismaService;
    const redis = {
      isHealthy: jest.fn().mockResolvedValue(true),
    } as unknown as RedisService;

    const result = await new HealthService(
      prisma,
      redis,
      new FakeClock('2026-11-22T12:00:00.000Z'),
    ).readiness();

    expect(result.status).toBe('error');
    expect(result.checks).toEqual({ database: 'down', redis: 'up' });
  });
});
