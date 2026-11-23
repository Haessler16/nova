import { Injectable, NotFoundException } from '@nestjs/common';
import { InstructionCategory, InstructionVisibility } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestNoteDto, ListGuestNotesQueryDto, UpdateGuestNoteDto } from './dto/instruction.dto';
import {
  allowedVisibilities,
  assertCanWriteVisibility,
  assertGuestInScope,
  canSeeConfidential,
} from './instructions.access';
import { GUEST_NOTE_SELECT, type GuestNoteRow } from './instructions.contracts';
import { parseOptionalDate } from './instructions.support';
import { redactSensitiveCardData } from './instruction-parser';

/** Guest-level notes: sticky operational notes that never touch billing. */
@Injectable()
export class GuestNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    context: TenantContext,
    guestId: string,
    query: ListGuestNotesQueryDto,
  ): Promise<{ items: GuestNoteRow[] }> {
    const propertyId = requirePropertyContext(context);
    await assertGuestInScope(this.prisma, context, propertyId, guestId);

    const visibility = allowedVisibilities(context);
    const includeConfidential = canSeeConfidential(context);

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
              OR: [{ expiresAt: null }, { expiresAt: { gt: this.clock.now() } }],
            }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: GUEST_NOTE_SELECT,
    });

    return { items };
  }

  async create(
    context: TenantContext,
    guestId: string,
    dto: CreateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    const propertyId = requirePropertyContext(context);
    await assertGuestInScope(this.prisma, context, propertyId, guestId);
    assertCanWriteVisibility(context, dto.visibility, dto.category);

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

  async update(
    context: TenantContext,
    guestId: string,
    noteId: string,
    dto: UpdateGuestNoteDto,
  ): Promise<GuestNoteRow> {
    const propertyId = requirePropertyContext(context);
    await assertGuestInScope(this.prisma, context, propertyId, guestId);

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
    assertCanWriteVisibility(context, dto.visibility, current.category);

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
}
