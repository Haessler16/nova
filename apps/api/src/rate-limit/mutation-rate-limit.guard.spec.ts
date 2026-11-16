import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { MutationRateLimitGuard } from './mutation-rate-limit.guard';
import type {
  MutationRateLimitDecision,
  MutationRateLimiter,
} from './mutation-rate-limiter.service';

function context(method: string): {
  executionContext: ExecutionContext;
  setHeader: jest.Mock;
  request: Request;
} {
  const setHeader = jest.fn();
  const request = {
    method,
    ip: '10.0.0.7',
    header: () => undefined,
  } as unknown as Request;

  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;

  return { executionContext, setHeader, request };
}

function limiter(decision: MutationRateLimitDecision): MutationRateLimiter & {
  check: jest.Mock;
} {
  return { check: jest.fn().mockResolvedValue(decision) } as unknown as MutationRateLimiter & {
    check: jest.Mock;
  };
}

describe('MutationRateLimitGuard', () => {
  it('does not count safe methods', async () => {
    const service = limiter({ limited: true });
    const guard = new MutationRateLimitGuard(service);
    const { executionContext } = context('GET');

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(service.check).not.toHaveBeenCalled();
  });

  it('allows a mutation below the limit', async () => {
    const guard = new MutationRateLimitGuard(limiter({ limited: false }));
    const { executionContext } = context('POST');

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('throws 429 with Retry-After when limited', async () => {
    const guard = new MutationRateLimitGuard(limiter({ limited: true, retryAfterSeconds: 60 }));
    const { executionContext, setHeader } = context('PATCH');

    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({
      status: 429,
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');

    try {
      await guard.canActivate(executionContext);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'rate_limited' });
    }
  });
});
