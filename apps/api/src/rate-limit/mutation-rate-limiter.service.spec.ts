import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { RedisService } from '../redis/redis.service';
import { MutationRateLimiter } from './mutation-rate-limiter.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

function request(
  init: {
    ip?: string;
    organizationId?: string;
    propertyId?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.organizationId !== undefined) {
    headers['x-organization-id'] = init.organizationId;
  }
  if (init.propertyId !== undefined) {
    headers['x-property-id'] = init.propertyId;
  }

  return {
    ip: init.ip ?? '10.0.0.7',
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function redisStub(counts: Array<number | null>) {
  const incrementWindow = jest.fn<Promise<number | null>, [string, number]>();
  for (const count of counts) {
    incrementWindow.mockResolvedValueOnce(count);
  }
  return { incrementWindow } as unknown as RedisService & {
    incrementWindow: jest.Mock<Promise<number | null>, [string, number]>;
  };
}

describe('MutationRateLimiter', () => {
  it('allows a request below the limit and counts IP plus tenant', async () => {
    const redis = redisStub([3, 1]);
    const limiter = new MutationRateLimiter(redis, config({ MUTATION_RATE_LIMIT_MAX: 10 }));

    await expect(
      limiter.check(request({ organizationId: ORGANIZATION_ID, propertyId: PROPERTY_ID })),
    ).resolves.toEqual({ limited: false });

    expect(redis.incrementWindow).toHaveBeenCalledTimes(2);
    expect(redis.incrementWindow.mock.calls[0][0]).toMatch(/^nova:rl:mutation:ip:[0-9a-f]{64}$/);
    expect(redis.incrementWindow.mock.calls[1][0]).toMatch(
      /^nova:rl:mutation:tenant:[0-9a-f]{64}$/,
    );
    expect(redis.incrementWindow.mock.calls.every(([, ttl]) => ttl === 60)).toBe(true);
  });

  it('never stores the raw IP or tenant in the Redis key', async () => {
    const redis = redisStub([1, 1]);
    const limiter = new MutationRateLimiter(redis, config());

    await limiter.check(request({ ip: '203.0.113.9', organizationId: ORGANIZATION_ID }));

    const keys = redis.incrementWindow.mock.calls.map(([key]) => key).join(' ');
    expect(keys).not.toContain('203.0.113.9');
    expect(keys).not.toContain(ORGANIZATION_ID);
  });

  it('limits when the IP bucket exceeds the maximum', async () => {
    const redis = redisStub([11]);
    const limiter = new MutationRateLimiter(
      redis,
      config({ MUTATION_RATE_LIMIT_MAX: 10, MUTATION_RATE_LIMIT_WINDOW_SECONDS: 30 }),
    );

    await expect(limiter.check(request())).resolves.toEqual({
      limited: true,
      retryAfterSeconds: 30,
    });
  });

  it('limits when the tenant bucket exceeds the maximum even if the IP is fine', async () => {
    const redis = redisStub([2, 11]);
    const limiter = new MutationRateLimiter(redis, config({ MUTATION_RATE_LIMIT_MAX: 10 }));

    await expect(
      limiter.check(request({ organizationId: ORGANIZATION_ID })),
    ).resolves.toMatchObject({ limited: true });
  });

  it('does not create a tenant bucket for malformed selectors', async () => {
    const redis = redisStub([1]);
    const limiter = new MutationRateLimiter(redis, config());

    await limiter.check(request({ organizationId: 'not-a-uuid' }));

    expect(redis.incrementWindow).toHaveBeenCalledTimes(1);
    expect(redis.incrementWindow.mock.calls[0][0]).toContain(':ip:');
  });

  it('fails open when Redis is unavailable', async () => {
    const redis = redisStub([null, null]);
    const limiter = new MutationRateLimiter(redis, config({ MUTATION_RATE_LIMIT_MAX: 1 }));

    await expect(limiter.check(request({ organizationId: ORGANIZATION_ID }))).resolves.toEqual({
      limited: false,
    });
  });

  it('skips Redis entirely when the limiter is disabled', async () => {
    const redis = redisStub([]);
    const limiter = new MutationRateLimiter(redis, config({ MUTATION_RATE_LIMIT_ENABLED: false }));

    await expect(limiter.check(request())).resolves.toEqual({ limited: false });
    expect(redis.incrementWindow).not.toHaveBeenCalled();
  });
});
