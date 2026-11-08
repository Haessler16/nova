import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { isUUID } from 'class-validator';
import { AuthenticatedRequest, DEV_USER_HEADER } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase-1 authentication boundary.
 *
 * There is no production identity provider yet. Outside production, and only
 * when AUTH_MODE=dev-header, the API resolves an actor from X-Dev-User-Id and
 * then loads the user from PostgreSQL. The header is NEVER trusted in
 * production, even if AUTH_MODE is misconfigured: the guard hard-fails.
 *
 * Tenant selection is separate: X-Organization-Id / X-Property-Id are only
 * selectors validated against active memberships (see TenantContextGuard).
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const authMode = this.config.get<string>('AUTH_MODE', 'disabled');

    if (nodeEnv === 'production' || authMode !== 'dev-header') {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message:
          'Authentication is not configured for this environment. Configure a real identity provider before use.',
      });
    }

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
}
