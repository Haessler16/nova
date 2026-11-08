import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface CreatedSession {
  sessionId: string;
  token: string;
  expiresAt: Date;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface SessionCreateMetadata {
  userAgent?: string;
  ipHash?: string;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Opaque server-side sessions. Only a SHA-256 digest of the random token is
 * persisted, so a database read cannot reconstruct bearer credentials.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const hours = config.get<number>('SESSION_TTL_HOURS', 8);
    this.ttlMs = hours * 60 * 60 * 1000;
  }

  async create(userId: string, metadata: SessionCreateMetadata = {}): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.ttlMs);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: metadata.userAgent?.slice(0, 255),
        ipHash: metadata.ipHash,
      },
      select: { id: true },
    });

    // Opportunistic cleanup keeps the table bounded without a background job.
    // Only expired/revoked rows are removed; active sessions are never touched.
    try {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }],
        },
      });
    } catch (error) {
      this.logger.debug(
        `Session cleanup skipped: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return { sessionId: session.id, token, expiresAt };
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    if (token.length === 0 || token.length > 512) {
      return null;
    }

    const now = new Date();
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: hashSessionToken(token),
        revokedAt: null,
        expiresAt: { gt: now },
        user: { status: RecordStatus.ACTIVE },
      },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (session === null) {
      return null;
    }

    if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      try {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { lastSeenAt: now },
          select: { id: true },
        });
      } catch (error) {
        // A failed last-seen update must not invalidate an otherwise valid
        // session. The token and expiry remain authoritative.
        this.logger.debug(
          `Session last-seen update failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      user: session.user,
    };
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async listForUser(userId: string): Promise<SessionSummary[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeForUser(userId: string, sessionId: string, reason: string): Promise<boolean> {
    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return updated.count === 1;
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const updated = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId !== undefined ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return updated.count;
  }

  /** Administrative revocation after verifying tenant-scoped membership. */
  async revokeAnyForUser(userId: string, sessionId: string, reason: string): Promise<boolean> {
    return this.revokeForUser(userId, sessionId, reason);
  }
}
