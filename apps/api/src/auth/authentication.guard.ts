import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { isUUID } from 'class-validator';
import { readCookie } from '../common/http/cookies';
import {
  AuthenticatedRequest,
  DEV_USER_HEADER,
  SESSION_COOKIE_NAME,
} from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

/**
 * Authentication boundary.
 *
 * - `local-session`: opaque session cookie validated against PostgreSQL.
 * - `dev-header`: `X-Dev-User-Id` in non-production only. This remains for
 *   deterministic tenant-isolation tests and must never be used in production.
 * - Anything else: reject.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const authMode = this.config.get<string>('AUTH_MODE', 'disabled');

    if (nodeEnv === 'production' && authMode === 'dev-header') {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Development header authentication is forbidden in production.',
      });
    }

    if (authMode === 'dev-header') {
      return this.authenticateWithDevHeader(request);
    }

    if (authMode === 'local-session') {
      return this.authenticateWithSession(request);
    }

    throw new UnauthorizedException({
      code: 'unauthenticated',
      message: 'Authentication is not configured for this environment.',
    });
  }

  private async authenticateWithDevHeader(request: AuthenticatedRequest): Promise<true> {
    const rawUserId = request.header(DEV_USER_HEADER);
    if (rawUserId === undefined || !isUUID(rawUserId)) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: `A valid ${DEV_USER_HEADER} header is required in development mode.`,
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: rawUserId, status: RecordStatus.ACTIVE },
      select: { id: true, email: true, name: true },
    });

    if (user === null) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Unknown or inactive development user.',
      });
    }

    request.actor = Object.freeze({ ...user });
    return true;
  }

  private async authenticateWithSession(request: AuthenticatedRequest): Promise<true> {
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME', SESSION_COOKIE_NAME);
    const token = readCookie(request, cookieName);

    if (token === undefined) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'A valid session is required.',
      });
    }

    const session = await this.sessions.resolve(token);
    if (session === null) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Your session is invalid or has expired. Please sign in again.',
      });
    }

    request.actor = Object.freeze({ ...session.user });
    request.sessionId = session.sessionId;
    return true;
  }
}
