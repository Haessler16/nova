import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface IssuedAuthToken {
  token: string;
  expiresAt: Date;
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * One-time password-reset / email-verification tokens. Only the SHA-256 digest
 * is stored. Issuing a token deletes the user's previous unused one, and the
 * partial unique index in PostgreSQL enforces at most one active token.
 */
@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly resetTtlMs: number;
  private readonly verificationTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.resetTtlMs =
      config.get<number>('PASSWORD_RESET_TTL_MINUTES', 30) * 60 * 1000;
    this.verificationTtlMs =
      config.get<number>('EMAIL_VERIFICATION_TTL_HOURS', 24) * 60 * 60 * 1000;
  }

  async issuePasswordReset(userId: string, requestedIpHash?: string): Promise<IssuedAuthToken> {
    await this.deleteExpired();
    return this.issue(
      'passwordResetToken',
      userId,
      this.resetTtlMs,
      requestedIpHash,
    );
  }

  async issueEmailVerification(
    userId: string,
    requestedIpHash?: string,
  ): Promise<IssuedAuthToken> {
    await this.deleteExpired();
    return this.issue(
      'emailVerificationToken',
      userId,
      this.verificationTtlMs,
      requestedIpHash,
    );
  }

  async consumePasswordReset(
    transaction: Prisma.TransactionClient,
    token: string,
    now = new Date(),
  ): Promise<string | null> {
    return this.consume(transaction, 'passwordResetToken', token, now);
  }

  async consumeEmailVerification(
    transaction: Prisma.TransactionClient,
    token: string,
    now = new Date(),
  ): Promise<string | null> {
    return this.consume(transaction, 'emailVerificationToken', token, now);
  }

  private async issue(
    model: 'passwordResetToken' | 'emailVerificationToken',
    userId: string,
    ttlMs: number,
    requestedIpHash: string | undefined,
  ): Promise<IssuedAuthToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.prisma.$transaction(async (transaction) => {
      if (model === 'passwordResetToken') {
        await transaction.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
        await transaction.passwordResetToken.create({
          data: {
            userId,
            tokenHash: hashOpaqueToken(token),
            expiresAt,
            requestedIpHash,
          },
          select: { id: true },
        });
        return;
      }

      await transaction.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
      await transaction.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: hashOpaqueToken(token),
          expiresAt,
          requestedIpHash,
        },
        select: { id: true },
      });
    });

    return { token, expiresAt };
  }

  private async consume(
    transaction: Prisma.TransactionClient,
    model: 'passwordResetToken' | 'emailVerificationToken',
    token: string,
    now: Date,
  ): Promise<string | null> {
    if (token.length < 20 || token.length > 256) {
      return null;
    }
    const tokenHash = hashOpaqueToken(token);

    if (model === 'passwordResetToken') {
      const row = await transaction.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        select: { id: true, userId: true },
      });
      if (row === null) {
        return null;
      }
      const updated = await transaction.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: now },
      });
      return updated.count === 1 ? row.userId : null;
    }

    const row = await transaction.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (row === null) {
      return null;
    }
    const updated = await transaction.emailVerificationToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    return updated.count === 1 ? row.userId : null;
  }

  private async deleteExpired(): Promise<void> {
    const now = new Date();
    try {
      await Promise.all([
        this.prisma.passwordResetToken.deleteMany({
          where: {
            OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }],
            createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.emailVerificationToken.deleteMany({
          where: {
            OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }],
            createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);
    } catch (error) {
      this.logger.debug(
        `Expired auth token cleanup skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
