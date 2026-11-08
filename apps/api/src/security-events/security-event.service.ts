import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { ListSecurityEventsQueryDto } from './dto/list-security-events.dto';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SecurityEventInput {
  type: string;
  severity?: SecuritySeverity;
  organizationId?: string;
  userId?: string;
  actorUserId?: string;
  ipHash?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Security events are append-only and intentionally separate from the hotel
 * AuditEvent stream: authentication failures can happen before a tenant is
 * resolved. Writes are best-effort for login paths (never turn a credential
 * rejection into a 500), but reads are tenant-scoped.
 */
@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);
  private readonly metadataLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.metadataLimit = config.get<number>('AUDIT_METADATA_MAX_BYTES', 8192);
  }

  async record(input: SecurityEventInput): Promise<void> {
    if (input.metadata !== undefined) {
      const bytes = Buffer.byteLength(JSON.stringify(input.metadata), 'utf8');
      if (bytes > this.metadataLimit) {
        throw new BadRequestException({
          code: 'security_event_metadata_too_large',
          message: `Security event metadata must not exceed ${this.metadataLimit} bytes.`,
        });
      }
    }

    await this.prisma.securityEvent.create({
      data: {
        type: input.type,
        severity: input.severity ?? 'INFO',
        organizationId: input.organizationId,
        userId: input.userId,
        actorUserId: input.actorUserId,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        correlationId: input.correlationId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
  }

  async safeRecord(input: SecurityEventInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.warn(
        `Security event '${input.type}' could not be persisted: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async list(
    context: TenantContext,
    query: ListSecurityEventsQueryDto,
  ): Promise<{
    items: Array<{
      id: string;
      type: string;
      severity: string;
      userId: string | null;
      actorUserId: string | null;
      occurredAt: Date;
      correlationId: string | null;
      metadata: Prisma.JsonValue | null;
    }>;
    nextCursor: string | null;
  }> {
    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.SecurityEventWhereInput = { organizationId: context.organizationId };

    if (query.type !== undefined) {
      where.type = query.type;
    }
    if (query.severity !== undefined) {
      where.severity = query.severity;
    }
    if (query.userId !== undefined) {
      where.userId = query.userId;
    }
    if (query.from !== undefined || query.to !== undefined) {
      where.occurredAt = {
        ...(query.from !== undefined ? { gte: query.from } : {}),
        ...(query.to !== undefined ? { lte: query.to } : {}),
      };
    }

    const rows = await this.prisma.securityEvent.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        severity: true,
        userId: true,
        actorUserId: true,
        occurredAt: true,
        correlationId: true,
        metadata: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}
