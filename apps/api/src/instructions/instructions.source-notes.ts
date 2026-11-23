import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  InstructionEventType,
  InstructionStatus,
  InstructionVisibility,
  Prisma,
} from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  ConfirmSourceSuggestionsDto,
  ParseSourceNoteDto,
} from './dto/instruction.dto';
import { assertCanWriteVisibility } from './instructions.access';
import {
  INSTRUCTION_SELECT,
  SOURCE_NOTE_SELECT,
  type InstructionRow,
  type SourceNoteRow,
} from './instructions.contracts';
import {
  hashContent,
  hashSourceText,
  hashSuggestion,
  INSTRUCTION_PARSER_VERSION,
  parseSourceNote,
  redactSensitiveCardData,
} from './instruction-parser';

interface SourceNoteDeps {
  prisma: PrismaService;
  audit: AuditService;
}

/**
 * Parses and stores the immutable source text. The original text is redacted
 * for PAN/CVV before insert; the exact received text digest is preserved.
 * Parsing never creates instructions, payments or charges.
 */
export async function parseSourceNoteFor(
  deps: SourceNoteDeps,
  context: TenantContext,
  propertyId: string,
  reservationId: string,
  dto: ParseSourceNoteDto,
): Promise<SourceNoteRow> {
  const parsed = parseSourceNote(dto.text);
  if (parsed.originalText.length === 0) {
    throw new BadRequestException({
      code: 'source_note_empty',
      message: 'The source note text must not be empty.',
    });
  }

  const contentHash = hashContent(parsed.originalText);
  const findExisting = (): Promise<SourceNoteRow | null> =>
    deps.prisma.reservationSourceNote.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        reservationId,
        contentHash,
        parserVersion: INSTRUCTION_PARSER_VERSION,
      },
      select: SOURCE_NOTE_SELECT,
    });

  const existing = await findExisting();
  if (existing !== null) {
    return existing;
  }

  try {
    return await deps.prisma.$transaction(async (transaction) => {
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

      await deps.audit.append(
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
      const raced = await findExisting();
      if (raced !== null) {
        return raced;
      }
    }
    throw error;
  }
}

export async function listSourceNotesFor(
  prisma: PrismaService,
  context: TenantContext,
  propertyId: string,
  reservationId: string,
): Promise<{ items: SourceNoteRow[] }> {
  const items = await prisma.reservationSourceNote.findMany({
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
export async function confirmSourceSuggestionsFor(
  deps: SourceNoteDeps,
  context: TenantContext,
  propertyId: string,
  reservationId: string,
  sourceNoteId: string,
  dto: ConfirmSourceSuggestionsDto,
): Promise<{ sourceNoteId: string; created: InstructionRow[]; skipped: number }> {
  const sourceNote = await deps.prisma.reservationSourceNote.findFirst({
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

  return deps.prisma.$transaction(async (transaction) => {
    const created: InstructionRow[] = [];
    let skipped = 0;

    for (const suggestion of dto.suggestions) {
      assertCanWriteVisibility(context, suggestion.visibility, suggestion.category);
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
      await deps.audit.append(
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
