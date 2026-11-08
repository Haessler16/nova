import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

function buildService(databaseHealthy: boolean, redisHealthy: boolean): HealthService {
  const prisma = {
    isHealthy: jest.fn().mockResolvedValue(databaseHealthy),
  } as unknown as PrismaService;
  const redis = {
    isHealthy: jest.fn().mockResolvedValue(redisHealthy),
  } as unknown as RedisService;

  return new HealthService(prisma, redis);
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

  it('reports database failures as down instead of throwing', async () => {
    const prisma = {
      isHealthy: jest.fn().mockRejectedValue(new Error('db unavailable')),
    } as unknown as PrismaService;
    const redis = {
      isHealthy: jest.fn().mockResolvedValue(true),
    } as unknown as RedisService;

    const result = await new HealthService(prisma, redis).readiness();

    expect(result.status).toBe('error');
    expect(result.checks).toEqual({ database: 'down', redis: 'up' });
  });
});
