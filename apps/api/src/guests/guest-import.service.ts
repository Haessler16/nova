import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuestImportFormatError, GuestImportPreview, parseGuestCsv } from './guest-import';

export interface GuestImportResult {
  importId: string;
  rowCount: number;
  createdCount: number;
  replayed: boolean;
}

const IMPORT_SELECT = {
  id: true,
  rowCount: true,
  createdCount: true,
} as const;

@Injectable()
export class GuestImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  preview(csv: string): GuestImportPreview {
    return this.parse(csv);
  }

  async commit(
    context: TenantContext,
    csv: string,
    idempotencyKey: string,
  ): Promise<GuestImportResult> {
    const propertyId = requirePropertyContext(context);
    const preview = this.parse(csv);

    if (preview.invalidRows > 0) {
      throw new BadRequestException({
        code: 'guest_import_invalid_rows',
        message: 'Corregí las filas inválidas antes de confirmar la importación.',
        details: {
          totalRows: preview.totalRows,
          invalidRows: preview.invalidRows,
          rows: preview.rows.filter((row) => row.errors.length > 0).slice(0, 50),
        },
      });
    }

    const existing = await this.prisma.guestImport.findFirst({
      where: { organizationId: context.organizationId, propertyId, idempotencyKey },
      select: IMPORT_SELECT,
    });
    if (existing !== null) {
      return this.replay(existing, preview.totalRows);
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        // Reserve the idempotency key first: concurrent requests with the same
        // key serialize here, and the loser rolls the whole transaction back.
        const record = await transaction.guestImport.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            idempotencyKey,
            rowCount: preview.totalRows,
            createdCount: preview.totalRows,
            createdByUserId: context.actor.id,
          },
          select: IMPORT_SELECT,
        });

        for (const row of preview.rows) {
          await transaction.guest.create({
            data: {
              organizationId: context.organizationId,
              propertyId,
              fullName: row.values.fullName,
              email: row.values.email,
              phone: row.values.phone,
              documentType: row.values.documentType,
              documentNumber: row.values.documentNumber,
              notes: row.values.notes,
            },
          });
        }

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'guest.imported',
            entityType: 'GuestImport',
            entityId: record.id,
            correlationId: context.correlationId,
            // Counts only: never copy names, emails or documents to audit.
            metadata: { rowCount: record.rowCount, createdCount: record.createdCount },
          },
          transaction,
        );

        return {
          importId: record.id,
          rowCount: record.rowCount,
          createdCount: record.createdCount,
          replayed: false,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.guestImport.findFirst({
          where: { organizationId: context.organizationId, propertyId, idempotencyKey },
          select: IMPORT_SELECT,
        });
        if (raced !== null) {
          return this.replay(raced, preview.totalRows);
        }
      }
      throw error;
    }
  }

  private replay(
    record: { id: string; rowCount: number; createdCount: number },
    rowCount: number,
  ): GuestImportResult {
    if (record.rowCount !== rowCount) {
      throw new ConflictException({
        code: 'idempotency_key_reused',
        message: 'La clave de idempotencia ya se usó con otro contenido.',
      });
    }
    return {
      importId: record.id,
      rowCount: record.rowCount,
      createdCount: record.createdCount,
      replayed: true,
    };
  }

  private parse(csv: string): GuestImportPreview {
    try {
      return parseGuestCsv(csv);
    } catch (error) {
      if (error instanceof GuestImportFormatError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }
}
