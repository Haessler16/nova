import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { Clock } from '../common/time/clock';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../security-events/security-event.service';
import {
  AUTH_USER_SELECT,
  AuthRequestMetadata,
  hashIp,
  invalidCredentials,
  invalidMfaCode,
  userAgent,
} from './auth.service.support';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';

/** Authenticator enrollment, activation and removal for an authenticated user. */
@Injectable()
export class MfaEnrollmentService {
  private readonly mfaIssuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly totp: TotpService,
    private readonly mfa: MfaService,
    private readonly passwords: PasswordService,
    private readonly securityEvents: SecurityEventService,
    private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.mfaIssuer = config.get<string>('MFA_ISSUER', 'NOVA PMS');
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
}
