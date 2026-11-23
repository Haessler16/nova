import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { Clock } from '../common/time/clock';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../security-events/security-event.service';
import {
  AUTH_USER_SELECT,
  AuthRequestMetadata,
  hashIp,
  invalidCredentials,
  userAgent,
} from './auth.service.support';
import { assertPasswordPolicy } from './password-policy';
import { PasswordService } from './password.service';

/** Self-service password change for an authenticated session. */
@Injectable()
export class PasswordChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly securityEvents: SecurityEventService,
    private readonly clock: Clock,
  ) {}

  /**
   * Rotates the password, clears lockout counters and revokes every other
   * session so a stolen cookie cannot survive the change.
   */
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
}
