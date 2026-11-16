import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstructionCategory,
  InstructionEventType,
  InstructionStatus,
  InstructionVisibility,
  Prisma,
} from '@prisma/client';
import { PERMISSIONS } from '../access/permissions';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmSourceSuggestionsDto,
  ConfirmSuggestionDto,
  CreateGuestNoteDto,
  CreateInstructionDto,
  ListGuestNotesQueryDto,
  ListInstructionsQueryDto,
  ParseSourceNoteDto,
  UpdateGuestNoteDto,
  UpdateInstructionDto,
} from './dto/instruction.dto';
import {
  hashContent,
  hashSourceText,
  hashSuggestion,
  INSTRUCTION_PARSER_VERSION,
  parseSourceNote,
  redactSensitiveCardData,
} from './instruction-parser';

const INSTRUCTION_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  sourceNoteId: true,
  category: true,
  title: true,
  body: true,
  tags: true,
  priority: true,
  status: true,
  source: true,
  sourceDepartment: true,
  visibility: true,
  assignedDepartment: true,
  assignedUserId: true,
  actionType: true,
  executionMoment: true,
  paymentMethod: true,
  actionDueAt: true,
  validFrom: true,
  validUntil: true,
  completedAt: true,
  completedByUserId: true,
  createdByUserId: true,
  dedupeKey: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SOURCE_NOTE_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  sourceTextOriginal: true,
  sourceTextHash: true,
  contentHash: true,
  parserVersion: true,
  redacted: true,
  suggestions: true,
  warnings: true,
  sourceSystem: true,
  sourceDepartment: true,
  externalReference: true,
  importedByUserId: true,
  importedAt: true,
} as const;

const GUEST_NOTE_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  guestId: true,
  category: true,
  body: true,
  priority: true,
  visibility: true,
  purpose: true,
  expiresAt: true,
  isActive: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type InstructionRow = Prisma.ReservationInstructionGetPayload<{
  select: typeof INSTRUCTION_SELECT;
}>;
type SourceNoteRow = Prisma.ReservationSourceNoteGetPayload<{ select: typeof SOURCE_NOTE_SELECT }>;
type GuestNoteRow = Prisma.GuestNoteGetPayload<{ select: typeof GUEST_NOTE_SELECT }>;

const ALLOWED_TRANSITIONS: Record<InstructionStatus, InstructionStatus[]> = {
  NEW: [
    InstructionStatus.ACKNOWLEDGED,
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  ACKNOWLEDGED: [
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  IN_PROGRESS: [
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  NEEDS_CLARIFICATION: [
    InstructionStatus.ACKNOWLEDGED,
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.DISMISSED,
  ],
  COMPLETED: [],
  DISMISSED: [],
};

@Injectable()
export class InstructionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    context: TenantContext,
    reservationId: string,
    query: ListInstructionsQueryDto,
  ): Promise<{ items: InstructionRow[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    await this.assertReservation(context, reservationId);

    const take = Math.min(query.limit ?? 50, 100);
    const visibility = this.allowedVisibilities(context);
    const includeConfidential = this.canSeeConfidential(context);
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
    const instruction = await this.findVisible(context, reservationId, instructionId);
    if (instruction.category === InstructionCategory.CONFIDENTIAL) {
      await this.audit.append({
        organizationId: context.organizationId,
        propertyId: requirePropertyContext(context),
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
    await this.assertReservation(context, reservationId);
    this.assertCanWriteVisibility(context, dto.visibility, dto.category);

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
    const current = await this.findVisible(context, reservationId, instructionId);
    this.assertCanWriteVisibility(context, dto.visibility, current.category);

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
    const current = await this.findVisible(context, reservationId, instructionId);

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
            ? { completedAt: new Date(), completedByUserId: context.actor.id }
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
    await this.findVisible(context, reservationId, instructionId);

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

  /**
   * Parses and stores the immutable source text. The original text is redacted
   * for PAN/CVV before insert; the exact received text digest is preserved.
   * Parsing never creates instructions, payments or charges.
   */
  async parseSource(
    context: TenantContext,
    reservationId: string,
    dto: ParseSourceNoteDto,
  ): Promise<SourceNoteRow> {
    const propertyId = requirePropertyContext(context);
    await this.assertReservation(context, reservationId);

    const parsed = parseSourceNote(dto.text);
    if (parsed.originalText.length === 0) {
      throw new BadRequestException({
        code: 'source_note_empty',
        message: 'The source note text must not be empty.',
      });
    }

    const contentHash = hashContent(parsed.originalText);
    const existing = await this.prisma.reservationSourceNote.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        reservationId,
        contentHash,
        parserVersion: INSTRUCTION_PARSER_VERSION,
      },
      select: SOURCE_NOTE_SELECT,
    });
    if (existing !== null) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.reservationSourceNote.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId,
            sourceTextOriginal: parsed.originalText,
            sourceTextHash: hashSourceText(dto.text),
            contentHash,
            parserVersion: INSTRUCTION_PARSER_VERSION,
            redacted: parsed.redacted,
            suggestions: parsed.suggestions as unknown as Prisma.InputJsonValue,
            warnings: parsed.warnings as unknown as Prisma.InputJsonValue,
            sourceSystem: dto.sourceSystem?.trim(),
            sourceDepartment: dto.sourceDepartment?.trim(),
            externalReference: dto.externalReference?.trim(),
            importedByUserId: context.actor.id,
          },
          select: SOURCE_NOTE_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'reservation.source_note.imported',
            entityType: 'ReservationSourceNote',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: {
              reservationId,
              parserVersion: created.parserVersion,
              redacted: created.redacted,
              suggestionCount: parsed.suggestions.length,
              warningCount: parsed.warnings.length,
            },
          },
          transaction,
        );

        return created;
      });
    } catch (error) {
      // Two concurrent retries can both pass the pre-check; the unique content
      // hash is the authority. Return the winner instead of failing the import.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.reservationSourceNote.findFirst({
          where: {
            organizationId: context.organizationId,
            propertyId,
            reservationId,
            contentHash,
            parserVersion: INSTRUCTION_PARSER_VERSION,
          },
          select: SOURCE_NOTE_SELECT,
        });
        if (raced !== null) {
          return raced;
        }
      }
      throw error;
    }
  }

  async listSourceNotes(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ items: SourceNoteRow[] }> {
    const propertyId = requirePropertyContext(context);
    await this.assertReservation(context, reservationId);

    const items = await this.prisma.reservationSourceNote.findMany({
      where: { organizationId: context.organizationId, propertyId, reservationId },
      orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
      select: SOURCE_NOTE_SELECT,
    });

    return { items };
  }

  /**
   * Confirms human-reviewed suggestions. Only instruction rows are created;
   * there is no side effect on folio, cash, payments, tariffs or room state.
   */
  async confirmSourceSuggestions(
    context: TenantContext,
    reservationId: string,
    sourceNoteId: string,
    dto: ConfirmSourceSuggestionsDto,
  ): Promise<{
    sourceNoteId: string;
    created: InstructionRow[];
    skipped: number;
  }> {
    const propertyId = requirePropertyContext(context);
    await this.assertReservation(context, reservationId);

    const sourceNote = await this.prisma.reservationSourceNote.findFirst({
      where: {
        id: sourceNoteId,
        organizationId: context.organizationId,
        propertyId,
        reservationId,
      },
      select: { id: true },
    });
    if (sourceNote === null) {
      throw new NotFoundException({
        code: 'source_note_not_found',
        message: 'Source note not found for the selected reservation.',
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const created: InstructionRow[] = [];
      let skipped = 0;

      for (const suggestion of dto.suggestions) {
        this.assertCanWriteVisibility(context, suggestion.visibility, suggestion.category);
        const dedupeKey = hashSuggestion(suggestion);
        const existing = await transaction.reservationInstruction.findFirst({
          where: { sourceNoteId: sourceNote.id, dedupeKey },
          select: { id: true },
        });
        if (existing !== null) {
          skipped += 1;
          continue;
        }

        const instruction = await transaction.reservationInstruction.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId,
            sourceNoteId: sourceNote.id,
            category: suggestion.category,
            title: redactSensitiveCardData(suggestion.title.trim()).text,
            body: redactSensitiveCardData(suggestion.body.trim()).text,
            priority: suggestion.priority ?? 'NORMAL',
            status: suggestion.status ?? InstructionStatus.NEW,
            source: 'IMPORT',
            visibility: suggestion.visibility ?? InstructionVisibility.ALL_AUTHORIZED,
            assignedDepartment: suggestion.assignedDepartment?.trim(),
            actionType: suggestion.actionType,
            executionMoment: suggestion.executionMoment,
            paymentMethod: suggestion.paymentMethod,
            dedupeKey,
            createdByUserId: context.actor.id,
          },
          select: INSTRUCTION_SELECT,
        });

        await transaction.instructionEvent.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            instructionId: instruction.id,
            eventType: InstructionEventType.CONFIRMED_FROM_SOURCE,
            actorUserId: context.actor.id,
            toStatus: instruction.status,
            metadata: { sourceNoteId: sourceNote.id },
          },
        });

        created.push(instruction);
      }

      if (created.length > 0) {
        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'instruction.confirmed_from_source',
            entityType: 'ReservationSourceNote',
            entityId: sourceNote.id,
            correlationId: context.correlationId,
            metadata: {
              reservationId,
              createdCount: created.length,
              skippedCount: skipped,
            },
          },
          transaction,
        );
      }

      return { sourceNoteId: sourceNote.id, created, skipped };
    });
  }

  async listGuestNotes(
    context: TenantContext,
    guestId: string,
    query: ListGuestNotesQueryDto,
  ): Promise<{ items: GuestNoteRow[] }> {
    const propertyId = requirePropertyContext(context);
    await this.assertGuest(context, guestId);

    const visibility = this.allowedVisibilities(context);
    const includeConfidential = this.canSeeConfidential(context);

    const items = await this.prisma.guestNote.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        guestId,
        visibility: { in: visibility },
        ...(includeConfidential ? {} : { category: { not: InstructionCategory.CONFIDENTIAL } }),
        ...(query.includeInactive === true
          ? {}
          : {
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: GUEST_NOTE_SELECT,
    });

    return { items };
  }

  async createGuestNote(
    context: TenantContext,
    guestId: string,
    dto: CreateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    const propertyId = requirePropertyContext(context);
    await this.assertGuest(context, guestId);
    this.assertCanWriteVisibility(context, dto.visibility, dto.category);

    return this.prisma.$transaction(async (transaction) => {
      const created = await transaction.guestNote.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          guestId,
          category: dto.category ?? InstructionCategory.GENERAL,
          body: redactSensitiveCardData(dto.body.trim()).text,
          priority: dto.priority ?? 'NORMAL',
          visibility: dto.visibility ?? InstructionVisibility.ALL_AUTHORIZED,
          purpose: dto.purpose?.trim(),
          expiresAt: parseOptionalDate(dto.expiresAt, 'expiresAt'),
          createdByUserId: context.actor.id,
          updatedByUserId: context.actor.id,
        },
        select: GUEST_NOTE_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'guest_note.created',
          entityType: 'GuestNote',
          entityId: created.id,
          correlationId: context.correlationId,
          metadata: { guestId, category: created.category, priority: created.priority },
        },
        transaction,
      );

      return created;
    });
  }

  async updateGuestNote(
    context: TenantContext,
    guestId: string,
    noteId: string,
    dto: UpdateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    const propertyId = requirePropertyContext(context);
    await this.assertGuest(context, guestId);

    const current = await this.prisma.guestNote.findFirst({
      where: {
        id: noteId,
        organizationId: context.organizationId,
        propertyId,
        guestId,
      },
      select: GUEST_NOTE_SELECT,
    });
    if (current === null) {
      throw new NotFoundException({
        code: 'guest_note_not_found',
        message: 'Guest note not found for the selected guest.',
      });
    }
    this.assertCanWriteVisibility(context, dto.visibility, current.category);

    if (Object.keys(dto).length === 0) {
      return current;
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.guestNote.update({
        where: { id: current.id },
        data: {
          ...(dto.body !== undefined
            ? { body: redactSensitiveCardData(dto.body.trim()).text }
            : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          ...(dto.purpose !== undefined ? { purpose: dto.purpose.trim() } : {}),
          ...(dto.expiresAt !== undefined
            ? { expiresAt: parseOptionalDate(dto.expiresAt, 'expiresAt') ?? null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: context.actor.id,
        },
        select: GUEST_NOTE_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'guest_note.updated',
          entityType: 'GuestNote',
          entityId: updated.id,
          correlationId: context.correlationId,
          metadata: { guestId, fields: Object.keys(dto), isActive: updated.isActive },
        },
        transaction,
      );

      return updated;
    });
  }

  private async assertReservation(context: TenantContext, reservationId: string): Promise<void> {
    const propertyId = requirePropertyContext(context);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: context.organizationId, propertyId },
      select: { id: true },
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }
  }

  private async assertGuest(context: TenantContext, guestId: string): Promise<void> {
    const propertyId = requirePropertyContext(context);
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId: context.organizationId, propertyId },
      select: { id: true },
    });
    if (guest === null) {
      throw new NotFoundException({
        code: 'guest_not_found',
        message: 'Guest not found in the selected property.',
      });
    }
  }

  private async findVisible(
    context: TenantContext,
    reservationId: string,
    instructionId: string,
  ): Promise<InstructionRow> {
    const propertyId = requirePropertyContext(context);
    const visibility = this.allowedVisibilities(context);
    const includeConfidential = this.canSeeConfidential(context);

    const instruction = await this.prisma.reservationInstruction.findFirst({
      where: {
        id: instructionId,
        organizationId: context.organizationId,
        propertyId,
        reservationId,
        visibility: { in: visibility },
        ...(includeConfidential ? {} : { category: { not: InstructionCategory.CONFIDENTIAL } }),
      },
      select: INSTRUCTION_SELECT,
    });

    if (instruction === null) {
      throw new NotFoundException({
        code: 'instruction_not_found',
        message: 'Instruction not found or not visible to your role.',
      });
    }

    return instruction;
  }

  private allowedVisibilities(context: TenantContext): InstructionVisibility[] {
    const result: InstructionVisibility[] = [InstructionVisibility.ALL_AUTHORIZED];
    const permissions = context.permissions;

    if (
      permissions.has(PERMISSIONS.FRONT_OFFICE_READ) ||
      permissions.has(PERMISSIONS.FRONT_OFFICE_MANAGE)
    ) {
      result.push(InstructionVisibility.FRONT_DESK);
    }
    if (permissions.has(PERMISSIONS.RESERVATIONS_MANAGE)) {
      result.push(InstructionVisibility.RESERVATIONS);
    }
    if (permissions.has(PERMISSIONS.REPORTS_FINANCIAL)) {
      result.push(InstructionVisibility.FINANCE);
    }
    if (
      permissions.has(PERMISSIONS.PROPERTY_MANAGE) ||
      permissions.has(PERMISSIONS.AUDIT_READ) ||
      permissions.has(PERMISSIONS.ORGANIZATION_PROPERTIES_MANAGE)
    ) {
      result.push(InstructionVisibility.MANAGEMENT);
    }
    return result;
  }

  private canSeeConfidential(context: TenantContext): boolean {
    return (
      context.permissions.has(PERMISSIONS.AUDIT_READ) ||
      context.permissions.has(PERMISSIONS.PROPERTY_MANAGE) ||
      context.permissions.has(PERMISSIONS.ORGANIZATION_PROPERTIES_MANAGE)
    );
  }

  private assertCanWriteVisibility(
    context: TenantContext,
    visibility: InstructionVisibility | undefined,
    category: InstructionCategory | undefined,
  ): void {
    if (category === InstructionCategory.CONFIDENTIAL && !this.canSeeConfidential(context)) {
      throw new ForbiddenException({
        code: 'instruction_confidential_forbidden',
        message: 'Your role cannot create or update confidential instructions.',
      });
    }

    if (visibility === undefined) {
      return;
    }

    const allowed = this.allowedVisibilities(context);
    if (!allowed.includes(visibility)) {
      throw new ForbiddenException({
        code: 'instruction_visibility_forbidden',
        message: 'Your role cannot target that visibility.',
        details: { visibility },
      });
    }
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (tags === undefined) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of tags) {
    const tag = value.trim().slice(0, 32);
    if (tag.length === 0) {
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(tag);
    if (normalized.length === 10) {
      break;
    }
  }
  return normalized;
}

function assertValidityRange(validFrom: Date | undefined, validUntil: Date | undefined): void {
  if (validFrom !== undefined && validUntil !== undefined && validUntil <= validFrom) {
    throw new BadRequestException({
      code: 'instruction_invalid_validity',
      message: 'validUntil must be later than validFrom.',
    });
  }
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'invalid_date',
      message: `${field} must be a valid ISO-8601 date.`,
    });
  }
  return date;
}

function eventTypeForStatus(status: InstructionStatus): InstructionEventType {
  switch (status) {
    case InstructionStatus.ACKNOWLEDGED:
      return InstructionEventType.ACKNOWLEDGED;
    case InstructionStatus.IN_PROGRESS:
      return InstructionEventType.IN_PROGRESS;
    case InstructionStatus.COMPLETED:
      return InstructionEventType.COMPLETED;
    case InstructionStatus.DISMISSED:
      return InstructionEventType.DISMISSED;
    case InstructionStatus.NEEDS_CLARIFICATION:
      return InstructionEventType.NEEDS_CLARIFICATION;
    default:
      return InstructionEventType.UPDATED;
  }
}

// Keep the imported type referenced so the public DTO stays in sync with the
// parser contract during refactors.
export type { ConfirmSuggestionDto };
