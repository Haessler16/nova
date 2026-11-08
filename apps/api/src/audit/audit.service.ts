import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditEventsQueryDto } from './dto/list-audit-events.dto';

export interface AuditAppendInput {
  organizationId: string;
  propertyId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

type AuditWriter = Pick<Prisma.TransactionClient, 'auditEvent'>;

/**
 * Audit writes are append-only. There is intentionally no update/delete
 * method and no HTTP route to mutate events. The database migration also
 * installs a trigger that rejects UPDATE/DELETE on AuditEvent.
 */
@Injectable()
export class AuditService {
  private readonly metadataLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.metadataLimit = config.get<number>('AUDIT_METADATA_MAX_BYTES', 8192);
  }

  async append(
    input: AuditAppendInput,
    writer: AuditWriter = this.prisma,
  ): Promise<{ id: string }> {
    const metadata = input.metadata;

    if (metadata !== undefined) {
      const bytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
      if (bytes > this.metadataLimit) {
        throw new BadRequestException({
          code: 'audit_metadata_too_large',
          message: `Audit metadata must not exceed ${this.metadataLimit} bytes.`,
        });
      }
    }

    return writer.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        correlationId: input.correlationId,
        reason: input.reason,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
  }

  async list(
    context: TenantContext,
    query: ListAuditEventsQueryDto,
  ): Promise<{
    items: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      actorUserId: string | null;
      occurredAt: Date;
      correlationId: string | null;
      reason: string | null;
      metadata: Prisma.JsonValue | null;
    }>;
    nextCursor: string | null;
  }> {
    if (context.propertyId === undefined) {
      throw new BadRequestException({
        code: 'property_context_required',
        message: 'Audit queries require property context.',
      });
    }

    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.AuditEventWhereInput = {
      organizationId: context.organizationId,
      propertyId: context.propertyId,
    };

    if (query.action !== undefined) {
      where.action = query.action;
    }
    if (query.entityType !== undefined) {
      where.entityType = query.entityType;
    }
    if (query.entityId !== undefined) {
      where.entityId = query.entityId;
    }

    const rows = await this.prisma.auditEvent.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        occurredAt: true,
        correlationId: true,
        reason: true,
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
