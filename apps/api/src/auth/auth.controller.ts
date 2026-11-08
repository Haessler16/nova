import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import {
  AuthenticatedRequest,
  DEV_USER_HEADER,
  SESSION_COOKIE_NAME,
} from '../common/http/request-context';
import { AuthenticationGuard } from './authentication.guard';
import { AuthService } from './auth.service';
import { authRequestMetadata } from './request-metadata';
import { CsrfService } from './csrf.service';
import {
  ChangePasswordDto,
  DisableMfaDto,
  ForgotPasswordDto,
  LoginDto,
  MfaCodeDto,
  MfaLoginDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/login.dto';

@ApiTags('auth')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@Controller('auth')
export class AuthController {
  private readonly sessionTtlMs: number;
  private readonly sessionCookieName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
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
  ) {
    this.assertLocalSessionMode();
    const result = await this.auth.login(
      dto.email,
      dto.password,
      dto.mfaCode,
      authRequestMetadata(request),
    );

    if (result.kind === 'mfa_challenge') {
      return {
        mfaRequired: true,
        challengeToken: result.challengeToken,
        expiresAt: result.expiresAt.toISOString(),
      };
    }

    return this.finishLogin(response, result.user, result.session.token, result.session.expiresAt);
  }

  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async completeMfaLogin(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: MfaLoginDto,
  ) {
    this.assertLocalSessionMode();
    const result = await this.auth.completeMfaLogin(
      dto.challengeToken,
      dto.code,
      authRequestMetadata(request),
    );
    if (result.kind !== 'session') {
      throw new ServiceUnavailableException({
        code: 'mfa_challenge_invalid',
        message: 'The MFA challenge could not be completed.',
      });
    }
    return this.finishLogin(response, result.user, result.session.token, result.session.expiresAt);
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
      await this.auth.revokeOwnSession(request.actor!.id, request.sessionId, authRequestMetadata(request));
    }
    this.clearCookies(response);
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

  @Get('sessions')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthenticationGuard)
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.auth.listSessions(request.actor!.id, request.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    await this.auth.revokeOwnSession(request.actor!.id, sessionId, authRequestMetadata(request));
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(
      request.actor!.id,
      dto.currentPassword,
      dto.newPassword,
      request.sessionId,
      authRequestMetadata(request),
    );
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  forgotPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ForgotPasswordDto,
  ) {
    return this.auth.requestPasswordReset(dto.email, authRequestMetadata(request));
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.newPassword, authRequestMetadata(request));
  }

  @Post('email/verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthenticationGuard)
  requestEmailVerification(@Req() request: AuthenticatedRequest) {
    return this.auth.requestEmailVerification(request.actor!.id, authRequestMetadata(request));
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(
    @Req() request: AuthenticatedRequest,
    @Body() dto: VerifyEmailDto,
  ): Promise<void> {
    await this.auth.verifyEmail(dto.token, authRequestMetadata(request));
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthenticationGuard)
  startMfaSetup(@Req() request: AuthenticatedRequest) {
    return this.auth.startMfaSetup(request.actor!.id, authRequestMetadata(request));
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard)
  async enableMfa(@Req() request: AuthenticatedRequest, @Body() dto: MfaCodeDto): Promise<void> {
    await this.auth.enableMfa(request.actor!.id, dto.code, authRequestMetadata(request));
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard)
  async disableMfa(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DisableMfaDto,
  ): Promise<void> {
    await this.auth.disableMfa(
      request.actor!.id,
      dto.password,
      dto.code,
      authRequestMetadata(request),
    );
  }

  private finishLogin(
    response: Response,
    user: { id: string; email: string; name: string },
    sessionToken: string,
    expiresAt: Date,
  ): {
    user: { id: string; email: string; name: string };
    expiresAt: string;
    csrfToken: string;
  } {
    const csrfToken = this.csrf.issue();
    response.cookie(this.sessionCookieName, sessionToken, this.cookieOptions(true));
    response.cookie(this.csrf.cookieName, csrfToken, this.cookieOptions(false));
    return { user, expiresAt: expiresAt.toISOString(), csrfToken };
  }

  private assertLocalSessionMode(): void {
    if (this.config.get<string>('AUTH_MODE', 'disabled') !== 'local-session') {
      throw new ServiceUnavailableException({
        code: 'auth_mode_unavailable',
        message: 'Local session authentication is not enabled.',
      });
    }
  }

  private clearCookies(response: Response): void {
    response.clearCookie(this.sessionCookieName, this.clearCookieOptions(true));
    response.clearCookie(this.csrf.cookieName, this.clearCookieOptions(false));
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

