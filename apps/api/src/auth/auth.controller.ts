import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import type { CookieOptions, Response } from 'express';
import { AuthenticatedRequest, SESSION_COOKIE_NAME } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticationGuard } from './authentication.guard';
import { CsrfService } from './csrf.service';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimiter } from './login-rate-limiter.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/**
 * A valid scrypt hash for a password that is not issued to any user. It keeps
 * the failed-login path doing real work even when the email is unknown.
 */
const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$_LHEVNMERXnKSJ59B37E4g$vxl8wF1ZxOrTKptLz1M6f13ECXXX6h0xLGhRUylUwjjFFrZxMHC9tob6nBE0NXPkHmSeT_GCq-6-JbOnRZ2VnQ';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly sessionTtlMs: number;
  private readonly sessionCookieName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly csrf: CsrfService,
    private readonly rateLimiter: LoginRateLimiter,
  ) {
    this.sessionTtlMs = this.config.get<number>('SESSION_TTL_HOURS', 8) * 60 * 60 * 1000;
    this.sessionCookieName = this.config.get<string>('SESSION_COOKIE_NAME', SESSION_COOKIE_NAME);
  }

  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  csrfToken(@Res({ passthrough: true }) response: Response): { csrfToken: string } {
    const token = this.csrf.issue();
    response.cookie(this.csrf.cookieName, token, this.cookieOptions(false));
    return { csrfToken: token };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: LoginDto,
  ): Promise<{
    user: { id: string; email: string; name: string };
    expiresAt: string;
    csrfToken: string;
  }> {
    if (this.config.get<string>('AUTH_MODE', 'disabled') !== 'local-session') {
      throw new ServiceUnavailableException({
        code: 'auth_mode_unavailable',
        message: 'Local session authentication is not enabled.',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const clientIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const decision = await this.rateLimiter.check(clientIp, email);
    if (decision.limited) {
      throw new HttpException(
        {
          code: 'rate_limited',
          message: 'Too many sign-in attempts. Try again later.',
          details: { retryAfterSeconds: decision.retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { email, status: RecordStatus.ACTIVE },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    const passwordMatches = await this.passwords.verify(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (user === null || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const session = await this.sessions.create(user.id);
    const csrfToken = this.csrf.issue();

    response.cookie(this.sessionCookieName, session.token, this.cookieOptions(true));
    response.cookie(this.csrf.cookieName, csrfToken, this.cookieOptions(false));

    return {
      user: { id: user.id, email: user.email, name: user.name },
      expiresAt: session.expiresAt.toISOString(),
      csrfToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthenticationGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.sessionId !== undefined) {
      await this.sessions.revoke(request.sessionId, 'user_logout');
    }

    response.clearCookie(this.sessionCookieName, this.clearCookieOptions(true));
    response.clearCookie(this.csrf.cookieName, this.clearCookieOptions(false));
  }

  @Get('session')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthenticationGuard)
  session(@Req() request: AuthenticatedRequest): {
    user: { id: string; email: string; name: string };
    authentication: 'local-session' | 'dev-header';
  } {
    return {
      user: request.actor as { id: string; email: string; name: string },
      authentication:
        this.config.get<string>('AUTH_MODE', 'disabled') === 'local-session'
          ? 'local-session'
          : 'dev-header',
    };
  }

  private cookieOptions(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      secure: this.config.get<string>('NODE_ENV', 'development') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.sessionTtlMs,
    };
  }

  private clearCookieOptions(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      secure: this.config.get<string>('NODE_ENV', 'development') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }
}
