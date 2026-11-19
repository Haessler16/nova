import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { Clock } from '../common/time/clock';
import { SecurityEventService } from '../security-events/security-event.service';
import { AuthTokenService, IssuedAuthToken } from './auth-token.service';
import { assertPasswordPolicy } from './password-policy';
import { PasswordService } from './password.service';
import { LoginRateLimiter } from './login-rate-limiter.service';
import { MfaService } from './mfa.service';
import { CreatedSession, SessionService, SessionSummary } from './session.service';
import { TotpService } from './totp.service';

const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$_LHEVNMERXnKSJ59B37E4g$vxl8wF1ZxOrTKptLz1M6f13ECXXX6h0xLGhRUylUwjjFFrZxMHC9tob6nBE0NXPkHmSeT_GCq-6-JbOnRZ2VnQ';

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  status: true,
  mfaEnabled: true,
  mfaSecret: true,
  mfaLastUsedStep: true,
  lockedUntil: true,
  failedLoginAttempts: true,
} as const;

export interface AuthRequestMetadata {
  ip: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export type LoginResult =
  | {
      kind: 'session';
      user: AuthenticatedUser;
      session: CreatedSession;
    }
  | {
      kind: 'mfa_challenge';
      challengeToken: string;
      expiresAt: Date;
    };

export interface IssuedTokenResponse {
  expiresAt: string;
  /** Only populated when AUTH_TOKEN_DELIVERY=response outside production. */
  token?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly lockoutThreshold: number;
  private readonly lockoutMs: number;
  private readonly tokenDelivery: 'log' | 'response' | 'none';
  private readonly nodeEnv: string;
  private readonly mfaIssuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly rateLimiter: LoginRateLimiter,
    private readonly tokens: AuthTokenService,
    private readonly totp: TotpService,
    private readonly mfa: MfaService,
    private readonly securityEvents: SecurityEventService,
    private readonly metrics: MetricsService,
    private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.lockoutThreshold = config.get<number>('ACCOUNT_LOCKOUT_THRESHOLD', 5);
    this.lockoutMs = config.get<number>('ACCOUNT_LOCKOUT_MINUTES', 15) * 60 * 1000;
    this.tokenDelivery = config.get<'log' | 'response' | 'none'>('AUTH_TOKEN_DELIVERY', 'log');
    this.nodeEnv = config.get<string>('NODE_ENV', 'development');
    this.mfaIssuer = config.get<string>('MFA_ISSUER', 'NOVA PMS');
  }

  async login(
    rawEmail: string,
    password: string,
    mfaCode: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<LoginResult> {
    const email = normalizeEmail(rawEmail);
    await this.assertRateLimit(email, metadata);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: AUTH_USER_SELECT,
    });

    const passwordMatches = await this.passwords.verify(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (user === null) {
      await this.recordLoginFailure(undefined, metadata, 'unknown_email');
      throw invalidCredentials();
    }

    if (user.lockedUntil !== null && user.lockedUntil.getTime() > this.clock.now().getTime()) {
      await this.securityEvents.safeRecord({
        type: 'auth.login_locked',
        severity: 'WARNING',
        userId: user.id,
        ipHash: hashIp(metadata.ip),
        userAgent: userAgent(metadata),
        correlationId: metadata.correlationId,
      });
      throw accountLocked(user.lockedUntil, this.clock.now());
    }

    if (user.status !== RecordStatus.ACTIVE || !passwordMatches) {
      await this.registerFailedAttempt(
        user.id,
        user.failedLoginAttempts,
        metadata,
        'bad_credentials',
      );
      throw invalidCredentials();
    }

    if (user.mfaEnabled) {
      if (mfaCode === undefined) {
        this.mfa.assertConfigured();
        const challenge = this.mfa.issueChallenge(user.id);
        this.metrics.incrementCounter('nova_auth_login_total', { result: 'mfa_challenge' });
        return {
          kind: 'mfa_challenge',
          challengeToken: challenge.token,
          expiresAt: challenge.expiresAt,
        };
      }

      await this.verifyMfaCode(user, mfaCode, metadata);
    }

    return this.completeLogin(user, metadata);
  }

  async completeMfaLogin(
    challengeToken: string,
    code: string,
    metadata: AuthRequestMetadata,
  ): Promise<LoginResult> {
    const userId = this.mfa.verifyChallenge(challengeToken);
    if (userId === null) {
      throw new UnauthorizedException({
        code: 'mfa_challenge_invalid',
        message: 'The MFA challenge is invalid or has expired. Sign in again.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });

    if (user === null || user.status !== RecordStatus.ACTIVE || !user.mfaEnabled) {
      throw invalidCredentials();
    }

    await this.assertRateLimit(user.email, metadata);
    await this.verifyMfaCode(user, code, metadata);
    return this.completeLogin(user, metadata);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });

    if (user === null || user.status !== RecordStatus.ACTIVE) {
      throw invalidCredentials();
    }

    const currentMatches = await this.passwords.verify(currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new UnauthorizedException({
        code: 'invalid_current_password',
        message: 'The current password is incorrect.',
      });
    }

    assertPasswordPolicy(newPassword, { email: user.email, name: user.name });
    if (await this.passwords.verify(newPassword, user.passwordHash)) {
      throw new BadRequestException({
        code: 'password_reuse',
        message: 'The new password must differ from the current password.',
      });
    }

    const passwordHash = await this.passwords.hash(newPassword);
    const now = this.clock.now();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: { id: true },
      });

      await transaction.session.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          ...(currentSessionId !== undefined ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: now, revokedReason: 'password_changed' },
      });
    });

    await this.securityEvents.safeRecord({
      type: 'auth.password_changed',
      severity: 'WARNING',
      userId: user.id,
      actorUserId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  async requestPasswordReset(
    rawEmail: string,
    metadata: AuthRequestMetadata,
  ): Promise<IssuedTokenResponse> {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (user === null || user.status === RecordStatus.DISABLED) {
      // Always return the same shape to reduce account enumeration.
      return { expiresAt: new Date(this.clock.now().getTime() + 30 * 60 * 1000).toISOString() };
    }

    const issued = await this.tokens.issuePasswordReset(user.id, hashIp(metadata.ip));
    await this.securityEvents.safeRecord({
      type: 'auth.password_reset_requested',
      severity: 'INFO',
      userId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
    return this.deliver(issued, 'password reset');
  }

  async resetPassword(
    token: string,
    newPassword: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (transaction) => {
      const userId = await this.tokens.consumePasswordReset(transaction, token, now);
      if (userId === null) {
        throw invalidToken();
      }

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true },
      });
      if (user === null || user.status === RecordStatus.DISABLED) {
        throw invalidToken();
      }

      assertPasswordPolicy(newPassword, { email: user.email, name: user.name });
      const passwordHash = await this.passwords.hash(newPassword);

      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: user.status === RecordStatus.INVITED ? RecordStatus.ACTIVE : user.status,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
        },
        select: { id: true },
      });

      await transaction.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_reset' },
      });

      return { userId: user.id };
    });

    await this.securityEvents.safeRecord({
      type: 'auth.password_reset_completed',
      severity: 'WARNING',
      userId: result.userId,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  async requestEmailVerification(
    userId: string,
    metadata: AuthRequestMetadata,
  ): Promise<{ alreadyVerified: boolean; expiresAt?: string; token?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, emailVerifiedAt: true },
    });
    if (user === null || user.status === RecordStatus.DISABLED) {
      throw invalidCredentials();
    }
    if (user.emailVerifiedAt !== null) {
      return { alreadyVerified: true };
    }

    const issued = await this.tokens.issueEmailVerification(user.id, hashIp(metadata.ip));
    await this.securityEvents.safeRecord({
      type: 'auth.email_verification_requested',
      userId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
    const delivered = this.deliver(issued, 'email verification');
    return { alreadyVerified: false, ...delivered };
  }

  async verifyEmail(token: string, metadata: AuthRequestMetadata): Promise<void> {
    const now = this.clock.now();
    const userId = await this.prisma.$transaction(async (transaction) => {
      const subjectId = await this.tokens.consumeEmailVerification(transaction, token, now);
      if (subjectId === null) {
        throw invalidToken();
      }
      const updated = await transaction.user.updateMany({
        where: { id: subjectId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      if (updated.count === 0) {
        const exists = await transaction.user.findUnique({
          where: { id: subjectId },
          select: { id: true },
        });
        if (exists === null) {
          throw invalidToken();
        }
      }
      return subjectId;
    });

    await this.securityEvents.safeRecord({
      type: 'auth.email_verified',
      userId,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  async startMfaSetup(
    userId: string,
    metadata: AuthRequestMetadata,
  ): Promise<{ secret: string; otpauthUri: string; issuer: string }> {
    this.mfa.assertConfigured();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (user === null) {
      throw invalidCredentials();
    }
    if (user.mfaEnabled) {
      throw new ConflictException({
        code: 'mfa_already_enabled',
        message: 'MFA is already enabled. Disable it before enrolling a new authenticator.',
      });
    }

    const secret = this.totp.generateSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: this.mfa.encryptSecret(secret),
        mfaEnabled: false,
        mfaEnrolledAt: null,
        mfaLastUsedStep: null,
      },
      select: { id: true },
    });

    await this.securityEvents.safeRecord({
      type: 'auth.mfa_setup_started',
      userId: user.id,
      actorUserId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });

    return {
      secret,
      otpauthUri: this.totp.provisioningUri({
        secret,
        email: user.email,
        issuer: this.mfaIssuer,
      }),
      issuer: this.mfaIssuer,
    };
  }

  async enableMfa(userId: string, code: string, metadata: AuthRequestMetadata): Promise<void> {
    this.mfa.assertConfigured();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, mfaEnabled: true, mfaSecret: true, mfaLastUsedStep: true },
    });
    if (user === null || user.mfaSecret === null) {
      throw new BadRequestException({
        code: 'mfa_setup_required',
        message: 'Start MFA setup before enabling it.',
      });
    }
    if (user.mfaEnabled) {
      throw new ConflictException({
        code: 'mfa_already_enabled',
        message: 'MFA is already enabled.',
      });
    }

    const verification = this.totp.verify(this.mfa.decryptSecret(user.mfaSecret), code);
    if (verification === null) {
      throw invalidMfaCode();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaEnrolledAt: this.clock.now(),
        mfaLastUsedStep: verification.step,
      },
      select: { id: true },
    });

    await this.securityEvents.safeRecord({
      type: 'auth.mfa_enabled',
      severity: 'WARNING',
      userId: user.id,
      actorUserId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  async disableMfa(
    userId: string,
    password: string,
    code: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...AUTH_USER_SELECT },
    });
    if (
      user === null ||
      user.status !== RecordStatus.ACTIVE ||
      !user.mfaEnabled ||
      user.mfaSecret === null
    ) {
      throw new ConflictException({
        code: 'mfa_not_enabled',
        message: 'MFA is not enabled for this account.',
      });
    }

    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'invalid_current_password',
        message: 'The current password is incorrect.',
      });
    }

    const verification = this.totp.verify(this.mfa.decryptSecret(user.mfaSecret), code);
    if (verification === null) {
      throw invalidMfaCode();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaEnrolledAt: null,
        mfaLastUsedStep: null,
      },
      select: { id: true },
    });

    await this.securityEvents.safeRecord({
      type: 'auth.mfa_disabled',
      severity: 'CRITICAL',
      userId: user.id,
      actorUserId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<Array<SessionSummary & { current: boolean }>> {
    const sessions = await this.sessions.listForUser(userId);
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeOwnSession(
    userId: string,
    sessionId: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const revoked = await this.sessions.revokeForUser(userId, sessionId, 'user_revoked');
    if (!revoked) {
      throw new BadRequestException({
        code: 'session_not_found',
        message: 'Active session not found for this user.',
      });
    }
    await this.securityEvents.safeRecord({
      type: 'auth.session_revoked',
      userId,
      actorUserId: userId,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
  }

  normalizeEmail(email: string): string {
    return normalizeEmail(email);
  }

  private async assertRateLimit(email: string, metadata: AuthRequestMetadata): Promise<void> {
    const decision = await this.rateLimiter.check(metadata.ip, email);
    if (decision.limited) {
      this.metrics.incrementCounter('nova_auth_login_total', { result: 'rate_limited' });
      throw new HttpException(
        {
          code: 'rate_limited',
          message: 'Too many sign-in attempts. Try again later.',
          details: { retryAfterSeconds: decision.retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async verifyMfaCode(
    user: {
      id: string;
      email: string;
      name: string;
      mfaSecret: string | null;
      mfaLastUsedStep: number | null;
      failedLoginAttempts: number;
    },
    code: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    this.mfa.assertConfigured();
    if (user.mfaSecret === null) {
      throw invalidMfaCode();
    }

    const verification = this.totp.verify(this.mfa.decryptSecret(user.mfaSecret), code);
    if (verification === null) {
      await this.registerFailedAttempt(
        user.id,
        user.failedLoginAttempts,
        metadata,
        'invalid_mfa_code',
      );
      throw invalidMfaCode();
    }

    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: verification.step } }],
      },
      data: { mfaLastUsedStep: verification.step },
    });

    if (updated.count === 0) {
      await this.registerFailedAttempt(user.id, user.failedLoginAttempts, metadata, 'mfa_replay');
      throw invalidMfaCode('This authentication code was already used. Wait for the next code.');
    }
  }

  private async completeLogin(
    user: { id: string; email: string; name: string },
    metadata: AuthRequestMetadata,
  ): Promise<LoginResult> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true },
    });

    const session = await this.sessions.create(user.id, {
      userAgent: userAgent(metadata),
      ipHash: hashIp(metadata.ip),
    });

    await this.securityEvents.safeRecord({
      type: 'auth.login_succeeded',
      userId: user.id,
      actorUserId: user.id,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
    });
    this.metrics.incrementCounter('nova_auth_login_total', { result: 'success' });

    return {
      kind: 'session',
      user: { id: user.id, email: user.email, name: user.name },
      session,
    };
  }

  private async registerFailedAttempt(
    userId: string,
    previousAttempts: number,
    metadata: AuthRequestMetadata,
    reason: string,
  ): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true, lockedUntil: true },
    });

    let lockedUntil = updated.lockedUntil;
    if (updated.failedLoginAttempts >= this.lockoutThreshold && lockedUntil === null) {
      lockedUntil = new Date(this.clock.now().getTime() + this.lockoutMs);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
        select: { id: true },
      });
    }

    await this.recordLoginFailure(userId, metadata, reason, {
      failedLoginAttempts: updated.failedLoginAttempts,
      previousAttempts,
      locked: lockedUntil !== null,
    });
    this.metrics.incrementCounter('nova_auth_login_total', { result: 'failure' });
  }

  private async recordLoginFailure(
    userId: string | undefined,
    metadata: AuthRequestMetadata,
    reason: string,
    metadataDetails: Record<string, unknown> = {},
  ): Promise<void> {
    await this.securityEvents.safeRecord({
      type: 'auth.login_failed',
      severity: 'WARNING',
      userId,
      ipHash: hashIp(metadata.ip),
      userAgent: userAgent(metadata),
      correlationId: metadata.correlationId,
      metadata: { reason, ...metadataDetails },
    });
  }

  private deliver(issued: IssuedAuthToken, purpose: string): IssuedTokenResponse {
    const response: IssuedTokenResponse = { expiresAt: issued.expiresAt.toISOString() };

    if (this.nodeEnv !== 'production' && this.tokenDelivery === 'response') {
      return { ...response, token: issued.token };
    }

    if (this.nodeEnv !== 'production' && this.tokenDelivery === 'log') {
      this.logger.warn(
        `Development-only ${purpose} token (expires ${issued.expiresAt.toISOString()}): ${issued.token}`,
      );
    } else if (this.tokenDelivery === 'none') {
      this.logger.warn(
        `${purpose} token generated but AUTH_TOKEN_DELIVERY=none; no email provider is configured.`,
      );
    }

    return response;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex');
}

function userAgent(metadata: AuthRequestMetadata): string | undefined {
  const value = metadata.userAgent?.trim();
  return value === undefined || value.length === 0 ? undefined : value.slice(0, 255);
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'invalid_credentials',
    message: 'Invalid email or password.',
  });
}

function invalidMfaCode(message = 'The authentication code is invalid.'): UnauthorizedException {
  return new UnauthorizedException({
    code: 'invalid_mfa_code',
    message,
  });
}

function invalidToken(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_auth_token',
    message: 'The token is invalid, expired or already used.',
  });
}

function accountLocked(lockedUntil: Date, now: Date): HttpException {
  throw new HttpException(
    {
      code: 'account_locked',
      message: 'The account is temporarily locked after repeated failed sign-in attempts.',
      details: {
        retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)),
      },
    },
    423,
  );
}
