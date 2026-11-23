import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PilotFeedbackStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePilotFeedbackDto, ListPilotFeedbackQueryDto } from './dto/pilot.dto';

const FEEDBACK_SELECT = Prisma.validator<Prisma.PilotFeedbackSelect>()({
  id: true,
  category: true,
  message: true,
  rating: true,
  context: true,
  status: true,
  userId: true,
  reviewedAt: true,
  reviewedByUserId: true,
  createdAt: true,
  updatedAt: true,
});

const CONTEXT_MAX_BYTES = 4096;

type FeedbackRow = Prisma.PilotFeedbackGetPayload<{ select: typeof FEEDBACK_SELECT }>;

export interface PilotFeedbackResponse {
  id: string;
  category: string;
  message: string;
  rating: number | null;
  context: Record<string, unknown> | null;
  status: PilotFeedbackStatus;
  userId: string;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapFeedback(row: FeedbackRow): PilotFeedbackResponse {
  return {
    ...row,
    context: (row.context ?? null) as Record<string, unknown> | null,
  };
}

@Injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async submit(
    context: TenantContext,
    dto: CreatePilotFeedbackDto,
  ): Promise<PilotFeedbackResponse> {
    const propertyId = requirePropertyContext(context);

    if (dto.context !== undefined) {
      const bytes = Buffer.byteLength(JSON.stringify(dto.context), 'utf8');
      if (bytes > CONTEXT_MAX_BYTES) {
        throw new BadRequestException({
          code: 'pilot_feedback_context_too_large',
          message: `Feedback context must not exceed ${CONTEXT_MAX_BYTES} bytes.`,
        });
      }
    }

    const created = await this.prisma.$transaction(async (transaction) => {
      const row = await transaction.pilotFeedback.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          userId: context.actor.id,
          category: dto.category,
          message: dto.message,
          rating: dto.rating ?? null,
          context:
            dto.context === undefined ? Prisma.DbNull : (dto.context as Prisma.InputJsonValue),
          status: PilotFeedbackStatus.OPEN,
        },
        select: FEEDBACK_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'pilot.feedback_submitted',
          entityType: 'PilotFeedback',
          entityId: row.id,
          correlationId: context.correlationId,
          metadata: { category: row.category, rating: row.rating ?? null },
        },
        transaction,
      );

      return row;
    });

    return mapFeedback(created);
  }

  async list(
    context: TenantContext,
    query: ListPilotFeedbackQueryDto,
  ): Promise<{ items: PilotFeedbackResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.PilotFeedbackWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const rows = await this.prisma.pilotFeedback.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: FEEDBACK_SELECT,
    });

    return { items: rows.map(mapFeedback) };
  }

  async get(context: TenantContext, feedbackId: string): Promise<PilotFeedbackResponse> {
    const propertyId = requirePropertyContext(context);
    const row = await this.prisma.pilotFeedback.findFirst({
      where: { id: feedbackId, organizationId: context.organizationId, propertyId },
      select: FEEDBACK_SELECT,
    });
    if (row === null) {
      throw new NotFoundException({
        code: 'pilot_feedback_not_found',
        message: 'Pilot feedback not found.',
      });
    }
    return mapFeedback(row);
  }

  async review(context: TenantContext, feedbackId: string): Promise<PilotFeedbackResponse> {
    const propertyId = requirePropertyContext(context);

    await this.prisma.$transaction(async (transaction) => {
      const row = await transaction.pilotFeedback.findFirst({
        where: { id: feedbackId, organizationId: context.organizationId, propertyId },
        select: { id: true, category: true, status: true },
      });
      if (row === null) {
        throw new NotFoundException({
          code: 'pilot_feedback_not_found',
          message: 'Pilot feedback not found.',
        });
      }
      if (row.status !== PilotFeedbackStatus.OPEN) {
        return;
      }

      await transaction.pilotFeedback.update({
        where: { id: row.id },
        data: {
          status: PilotFeedbackStatus.REVIEWED,
          reviewedAt: this.clock.now(),
          reviewedByUserId: context.actor.id,
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'pilot.feedback_reviewed',
          entityType: 'PilotFeedback',
          entityId: row.id,
          correlationId: context.correlationId,
          metadata: { category: row.category },
        },
        transaction,
      );
    });

    return this.get(context, feedbackId);
  }
}
