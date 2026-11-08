import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationGuard } from './authentication.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

const SESSIONS = {} as SessionService;

const USER_ID = '00000000-0000-4000-8000-000000000011';

function buildContext(headers: Record<string, string>): ExecutionContext {
  const request = {
    header: jest.fn((name: string) => headers[name.toLowerCase()]),
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildConfig(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('AuthenticationGuard (development header mode)', () => {
  it('refuses the development header in production even if AUTH_MODE is misconfigured', async () => {
    const prisma = {} as PrismaService;
    const guard = new AuthenticationGuard(
      buildConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev-header' }),
      prisma,
      SESSIONS,
    );

    await expect(
      guard.canActivate(buildContext({ 'x-dev-user-id': USER_ID })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects requests without a valid dev user header', async () => {
    const guard = new AuthenticationGuard(
      buildConfig({ NODE_ENV: 'test', AUTH_MODE: 'dev-header' }),
      {} as PrismaService,
      SESSIONS,
    );

    await expect(guard.canActivate(buildContext({}))).rejects.toMatchObject({
      response: { code: 'unauthenticated' },
    });
  });

  it('loads an active user and attaches an immutable actor', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: USER_ID,
      email: 'admin@demo.nova.local',
      name: 'Admin Demo',
    });
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const context = buildContext({ 'x-dev-user-id': USER_ID });
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();

    const guard = new AuthenticationGuard(
      buildConfig({ NODE_ENV: 'test', AUTH_MODE: 'dev-header' }),
      prisma,
      SESSIONS,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.actor).toEqual({
      id: USER_ID,
      email: 'admin@demo.nova.local',
      name: 'Admin Demo',
    });
    expect(Object.isFrozen(request.actor)).toBe(true);
  });
});
