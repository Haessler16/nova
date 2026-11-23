import { ConflictException, Injectable } from '@nestjs/common';
import {
  InstructionCategory,
  InstructionEventType,
  InstructionStatus,
  InstructionVisibility,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmSourceSuggestionsDto,
  CreateGuestNoteDto,
  CreateInstructionDto,
  ListGuestNotesQueryDto,
  ListInstructionsQueryDto,
  ParseSourceNoteDto,
  UpdateGuestNoteDto,
  UpdateInstructionDto,
} from './dto/instruction.dto';
import { GuestNotesService } from './guest-notes.service';
import {
  allowedVisibilities,
  assertCanWriteVisibility,
  assertReservationInScope,
  canSeeConfidential,
  findVisibleInstruction,
} from './instructions.access';
import {
  INSTRUCTION_SELECT,
  type GuestNoteRow,
  type InstructionRow,
  type SourceNoteRow,
} from './instructions.contracts';
import {
  confirmSourceSuggestionsFor,
  listSourceNotesFor,
  parseSourceNoteFor,
} from './instructions.source-notes';
import {
  ALLOWED_TRANSITIONS,
  assertValidityRange,
  eventTypeForStatus,
  normalizeTags,
  parseOptionalDate,
} from './instructions.support';
import { redactSensitiveCardData } from './instruction-parser';

export type { InstructionRow, SourceNoteRow, GuestNoteRow } from './instructions.contracts';

@Injectable()
export class InstructionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly guestNotes: GuestNotesService,
  ) {}

  async list(
    context: TenantContext,
    reservationId: string,
    query: ListInstructionsQueryDto,
  ): Promise<{ items: InstructionRow[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    await assertReservationInScope(this.prisma, context, propertyId, reservationId);

    const take = Math.min(query.limit ?? 50, 100);
    const visibility = allowedVisibilities(context);
    const includeConfidential = canSeeConfidential(context);
    const where: Prisma.ReservationInstructionWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      reservationId,
      visibility: { in: visibility },
      ...(includeConfidential ? {} : { category: { not: InstructionCategory.CONFIDENTIAL } }),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.priority !== undefined ? { priority: query.priority } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.actionType !== undefined ? { actionType: query.actionType } : {}),
      ...(query.executionMoment !== undefined ? { executionMoment: query.executionMoment } : {}),
    };

    if (query.includeCompleted !== true && query.status === undefined) {
      where.status = {
        notIn: [InstructionStatus.COMPLETED, InstructionStatus.DISMISSED],
      };
    }

    const rows = await this.prisma.reservationInstruction.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ priority: 'desc' }, { status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: INSTRUCTION_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    const confidentialIds = items
      .filter((item) => item.category === InstructionCategory.CONFIDENTIAL)
      .map((item) => item.id);
    if (confidentialIds.length > 0) {
      await this.audit.append({
        organizationId: context.organizationId,
        propertyId,
        actorUserId: context.actor.id,
        action: 'instruction.confidential_listed',
        entityType: 'Reservation',
        entityId: reservationId,
        correlationId: context.correlationId,
        metadata: { instructionIds: confidentialIds },
      });
    }

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async get(
    context: TenantContext,
    reservationId: string,
    instructionId: string,
  ): Promise<InstructionRow> {
    const propertyId = requirePropertyContext(context);
    const instruction = await findVisibleInstruction(
      this.prisma,
      context,
      propertyId,
      reservationId,
      instructionId,
    );
    if (instruction.category === InstructionCategory.CONFIDENTIAL) {
      await this.audit.append({
        organizationId: context.organizationId,
        propertyId,
        actorUserId: context.actor.id,
        action: 'instruction.confidential_read',
        entityType: 'ReservationInstruction',
        entityId: instruction.id,
        correlationId: context.correlationId,
        metadata: { reservationId },
      });
    }
    return instruction;
  }

  async create(
    context: TenantContext,
    reservationId: string,
    dto: CreateInstructionDto,
  ): Promise<InstructionRow> {
    const propertyId = requirePropertyContext(context);
    await assertReservationInScope(this.prisma, context, propertyId, reservationId);
    assertCanWriteVisibility(context, dto.visibility, dto.category);

    const actionDueAt = parseOptionalDate(dto.actionDueAt, 'actionDueAt');
    const validFrom = parseOptionalDate(dto.validFrom, 'validFrom');
    const validUntil = parseOptionalDate(dto.validUntil, 'validUntil');
    assertValidityRange(validFrom, validUntil);

    return this.prisma.$transaction(async (transaction) => {
      const created = await transaction.reservationInstruction.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId,
          category: dto.category ?? InstructionCategory.GENERAL,
          // Defense in depth: never persist a PAN/CVV even if an operator pastes
          // one into a free-text title or body.
          title: redactSensitiveCardData(dto.title.trim()).text,
          body: redactSensitiveCardData(dto.body.trim()).text,
          tags: normalizeTags(dto.tags),
          priority: dto.priority ?? 'NORMAL',
          visibility: dto.visibility ?? InstructionVisibility.ALL_AUTHORIZED,
          sourceDepartment: dto.sourceDepartment?.trim(),
          assignedDepartment: dto.assignedDepartment?.trim(),
          assignedUserId: dto.assignedUserId,
          actionType: dto.actionType,
          executionMoment: dto.executionMoment,
          paymentMethod: dto.paymentMethod,
          actionDueAt,
          validFrom,
          validUntil,
          createdByUserId: context.actor.id,
        },
        select: INSTRUCTION_SELECT,
      });

      await transaction.instructionEvent.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          instructionId: created.id,
          eventType: InstructionEventType.CREATED,
          actorUserId: context.actor.id,
          toStatus: created.status,
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'instruction.created',
          entityType: 'ReservationInstruction',
          entityId: created.id,
          correlationId: context.correlationId,
          metadata: {
            reservationId,
            category: created.category,
            priority: created.priority,
            visibility: created.visibility,
            actionType: created.actionType,
          },
        },
        transaction,
      );

      return created;
    });
  }

  async update(
    context: TenantContext,
    reservationId: string,
    instructionId: string,
    dto: UpdateInstructionDto,
  ): Promise<InstructionRow> {
    const propertyId = requirePropertyContext(context);
    const current = await findVisibleInstruction(
      this.prisma,
      context,
      propertyId,
      reservationId,
      instructionId,
    );
    assertCanWriteVisibility(context, dto.visibility, current.category);

    if (Object.keys(dto).length === 0) {
      return current;
    }

    const nextValidFrom =
      dto.validFrom !== undefined
        ? parseOptionalDate(dto.validFrom, 'validFrom')
        : (current.validFrom ?? undefined);
    const nextValidUntil =
      dto.validUntil !== undefined
        ? parseOptionalDate(dto.validUntil, 'validUntil')
        : (current.validUntil ?? undefined);
    assertValidityRange(nextValidFrom, nextValidUntil);

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.reservationInstruction.update({
        where: { id: current.id },
        data: {
          ...(dto.title !== undefined
            ? { title: redactSensitiveCardData(dto.title.trim()).text }
            : {}),
          ...(dto.body !== undefined
            ? { body: redactSensitiveCardData(dto.body.trim()).text }
            : {}),
          ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          ...(dto.assignedDepartment !== undefined
            ? { assignedDepartment: dto.assignedDepartment.trim() }
            : {}),
          ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
          ...(dto.actionDueAt !== undefined
            ? { actionDueAt: parseOptionalDate(dto.actionDueAt, 'actionDueAt') ?? null }
            : {}),
          ...(dto.validFrom !== undefined ? { validFrom: nextValidFrom ?? null } : {}),
          ...(dto.validUntil !== undefined ? { validUntil: nextValidUntil ?? null } : {}),
        },
        select: INSTRUCTION_SELECT,
      });

      await transaction.instructionEvent.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          instructionId: updated.id,
          eventType: InstructionEventType.UPDATED,
          actorUserId: context.actor.id,
          fromStatus: current.status,
          toStatus: updated.status,
          metadata: { fields: Object.keys(dto) },
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'instruction.updated',
          entityType: 'ReservationInstruction',
          entityId: updated.id,
          correlationId: context.correlationId,
          metadata: { reservationId, fields: Object.keys(dto) },
        },
        transaction,
      );

      return updated;
    });
  }

  async transition(
    context: TenantContext,
    reservationId: string,
    instructionId: string,
    target: InstructionStatus,
    reason?: string,
  ): Promise<InstructionRow> {
    const propertyId = requirePropertyContext(context);
    const current = await findVisibleInstruction(
      this.prisma,
      context,
      propertyId,
      reservationId,
      instructionId,
    );

    if (current.status === target) {
      return current;
    }

    if (!ALLOWED_TRANSITIONS[current.status].includes(target)) {
      throw new ConflictException({
        code: 'instruction_invalid_transition',
        message: `Cannot move an instruction from ${current.status} to ${target}.`,
        details: { from: current.status, to: target },
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.reservationInstruction.update({
        where: { id: current.id },
        data: {
          status: target,
          ...(target === InstructionStatus.COMPLETED
            ? { completedAt: this.clock.now(), completedByUserId: context.actor.id }
            : {}),
        },
        select: INSTRUCTION_SELECT,
      });

      await transaction.instructionEvent.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          instructionId: current.id,
          eventType: eventTypeForStatus(target),
          actorUserId: context.actor.id,
          fromStatus: current.status,
          toStatus: target,
          reason: reason?.trim(),
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: `instruction.${target.toLowerCase()}`,
          entityType: 'ReservationInstruction',
          entityId: current.id,
          correlationId: context.correlationId,
          reason: reason?.trim(),
          metadata: { reservationId, from: current.status, to: target },
        },
        transaction,
      );

      return updated;
    });
  }

  async events(
    context: TenantContext,
    reservationId: string,
    instructionId: string,
  ): Promise<{
    items: Array<{
      id: string;
      eventType: InstructionEventType;
      actorUserId: string | null;
      fromStatus: InstructionStatus | null;
      toStatus: InstructionStatus | null;
      reason: string | null;
      metadata: Prisma.JsonValue | null;
      occurredAt: Date;
    }>;
  }> {
    const propertyId = requirePropertyContext(context);
    await findVisibleInstruction(this.prisma, context, propertyId, reservationId, instructionId);

    const items = await this.prisma.instructionEvent.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        instructionId,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        eventType: true,
        actorUserId: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        metadata: true,
        occurredAt: true,
      },
    });

    return { items };
  }

  async parseSource(
    context: TenantContext,
    reservationId: string,
    dto: ParseSourceNoteDto,
  ): Promise<SourceNoteRow> {
    const propertyId = requirePropertyContext(context);
    await assertReservationInScope(this.prisma, context, propertyId, reservationId);
    return parseSourceNoteFor(
      { prisma: this.prisma, audit: this.audit },
      context,
      propertyId,
      reservationId,
      dto,
    );
  }

  async listSourceNotes(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ items: SourceNoteRow[] }> {
    const propertyId = requirePropertyContext(context);
    await assertReservationInScope(this.prisma, context, propertyId, reservationId);
    return listSourceNotesFor(this.prisma, context, propertyId, reservationId);
  }

  async confirmSourceSuggestions(
    context: TenantContext,
    reservationId: string,
    sourceNoteId: string,
    dto: ConfirmSourceSuggestionsDto,
  ): Promise<{ sourceNoteId: string; created: InstructionRow[]; skipped: number }> {
    const propertyId = requirePropertyContext(context);
    await assertReservationInScope(this.prisma, context, propertyId, reservationId);
    return confirmSourceSuggestionsFor(
      { prisma: this.prisma, audit: this.audit },
      context,
      propertyId,
      reservationId,
      sourceNoteId,
      dto,
    );
  }

  async listGuestNotes(
    context: TenantContext,
    guestId: string,
    query: ListGuestNotesQueryDto,
  ): Promise<{ items: GuestNoteRow[] }> {
    return this.guestNotes.list(context, guestId, query);
  }

  async createGuestNote(
    context: TenantContext,
    guestId: string,
    dto: CreateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    return this.guestNotes.create(context, guestId, dto);
  }

  async updateGuestNote(
    context: TenantContext,
    guestId: string,
    noteId: string,
    dto: UpdateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    return this.guestNotes.update(context, guestId, noteId, dto);
  }
}

// Keep the imported type referenced so the public DTO stays in sync with the
// parser contract during refactors.
export type { ConfirmSuggestionDto } from './dto/instruction.dto';
