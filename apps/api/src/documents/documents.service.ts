import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { calendarDateInTimezone } from '../common/time/property-day';
import { PrismaService } from '../prisma/prisma.service';
import { signatureRequired, type DocumentContext, type DocumentType } from './document-context';
import {
  buildDocumentContext,
  DOCUMENT_METADATA_SELECT,
  serializeMetadata,
} from './documents.context';
import { renderDocumentPdf } from './document-pdf';
import { renderDocumentHtml } from './document-renderer';
import type {
  CreatePrintEventDto,
  DocumentSourceDto,
  GenerateDocumentDto,
  ListDocumentsQueryDto,
  ListDocumentTemplatesQueryDto,
  PreviewDocumentDto,
  RegisterPhysicalSignatureDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async templates(
    tenant: TenantContext,
    query: ListDocumentTemplatesQueryDto,
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    const propertyId = this.requireProperty(tenant);
    const rows = await this.prisma.documentTemplate.findMany({
      where: {
        organizationId: tenant.organizationId,
        propertyId,
        isActive: true,
        isPublished: true,
        ...(query.type !== undefined ? { key: query.type } : {}),
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        key: true,
        name: true,
        title: true,
        locale: true,
        version: true,
        publishedAt: true,
      },
    });

    return {
      items: rows.map((row) => ({
        ...row,
        signatureRequired: signatureRequired(row.key as DocumentType),
      })),
    };
  }

  async preview(
    tenant: TenantContext,
    dto: PreviewDocumentDto,
  ): Promise<{
    html: string;
    document: Record<string, unknown>;
    template: Record<string, unknown>;
  }> {
    const generatedAt = this.clock.now();
    const { context, template } = await this.buildContext(tenant, dto, null, generatedAt);
    const html = renderDocumentHtml(context);

    await this.audit.append({
      organizationId: tenant.organizationId,
      propertyId: this.requireProperty(tenant),
      actorUserId: tenant.actor.id,
      action: 'document.previewed',
      entityType: 'Reservation',
      entityId: dto.reservationId,
      correlationId: tenant.correlationId,
      metadata: {
        documentType: dto.type,
        templateId: template.id,
        templateVersion: template.version,
      },
    });

    return {
      html,
      document: {
        type: context.document.type,
        typeLabel: context.document.typeLabel,
        title: context.document.title,
        number: null,
        generatedAt: context.document.generatedAt,
      },
      template: {
        id: template.id,
        key: template.key,
        name: template.name,
        version: template.version,
        locale: template.locale,
      },
    };
  }

  async generate(
    tenant: TenantContext,
    dto: GenerateDocumentDto,
  ): Promise<Record<string, unknown>> {
    const propertyId = this.requireProperty(tenant);
    const id = randomUUID();
    const generatedAt = this.clock.now();
    const { context, template } = await this.buildContext(tenant, dto, null, generatedAt);
    const number = this.nextNumber(id, generatedAt, context.property.timezone);
    context.document.number = number;
    const pdf = await renderDocumentPdf(context);
    const sha256 = createHash('sha256').update(pdf.buffer).digest('hex');

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          id,
          organizationId: tenant.organizationId,
          propertyId,
          templateId: template.id,
          number,
          documentType: dto.type,
          locale: context.document.locale,
          templateVersion: template.version,
          guestId: context.guestId,
          reservationId: dto.reservationId,
          stayId: context.stay?.id ?? null,
          generatedById: tenant.actor.id,
          generatedAt,
          snapshot: context as unknown as Prisma.InputJsonValue,
          content: pdf.buffer,
          mimeType: 'application/pdf',
          fileSizeBytes: pdf.buffer.byteLength,
          pageCount: pdf.pageCount,
          sha256,
          storageKey: `db://generated-documents/${id}`,
        },
        select: DOCUMENT_METADATA_SELECT,
      });

      await this.audit.append(
        {
          organizationId: tenant.organizationId,
          propertyId,
          actorUserId: tenant.actor.id,
          action: 'document.generated',
          entityType: 'GeneratedDocument',
          entityId: created.id,
          correlationId: tenant.correlationId,
          metadata: {
            documentType: dto.type,
            templateId: template.id,
            templateVersion: template.version,
            reservationId: dto.reservationId,
            sha256,
            fileSizeBytes: pdf.buffer.byteLength,
          },
        },
        tx,
      );

      return created;
    });

    return serializeMetadata(row);
  }

  async list(
    tenant: TenantContext,
    query: ListDocumentsQueryDto,
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    const propertyId = this.requireProperty(tenant);
    const where: Prisma.GeneratedDocumentWhereInput = {
      organizationId: tenant.organizationId,
      propertyId,
      ...(query.reservationId !== undefined ? { reservationId: query.reservationId } : {}),
      ...(query.guestId !== undefined ? { guestId: query.guestId } : {}),
      ...(query.stayId !== undefined ? { stayId: query.stayId } : {}),
      ...(query.documentType !== undefined ? { documentType: query.documentType } : {}),
    };

    const rows = await this.prisma.generatedDocument.findMany({
      where,
      take: query.limit ?? 50,
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      select: DOCUMENT_METADATA_SELECT,
    });

    return { items: rows.map(serializeMetadata) };
  }

  async get(tenant: TenantContext, id: string): Promise<Record<string, unknown>> {
    const propertyId = this.requireProperty(tenant);
    const row = await this.prisma.generatedDocument.findFirst({
      where: { id, organizationId: tenant.organizationId, propertyId },
      select: {
        ...DOCUMENT_METADATA_SELECT,
        printEvents: {
          orderBy: { requestedAt: 'desc' },
          select: {
            id: true,
            type: true,
            requestedAt: true,
            note: true,
            requestedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (row === null) {
      throw new NotFoundException({
        code: 'document_not_found',
        message: 'Document not found in the current property.',
      });
    }
    return serializeMetadata(row);
  }

  async download(
    tenant: TenantContext,
    id: string,
  ): Promise<{ fileName: string; mimeType: string; content: Buffer; sha256: string }> {
    const propertyId = this.requireProperty(tenant);
    const row = await this.prisma.generatedDocument.findFirst({
      where: { id, organizationId: tenant.organizationId, propertyId },
      select: {
        id: true,
        number: true,
        documentType: true,
        mimeType: true,
        content: true,
        sha256: true,
        fileSizeBytes: true,
      },
    });
    if (row === null) {
      throw new NotFoundException({
        code: 'document_not_found',
        message: 'Document not found in the current property.',
      });
    }

    await this.audit.append({
      organizationId: tenant.organizationId,
      propertyId,
      actorUserId: tenant.actor.id,
      action: 'document.downloaded',
      entityType: 'GeneratedDocument',
      entityId: row.id,
      correlationId: tenant.correlationId,
      metadata: {
        documentType: row.documentType,
        sha256: row.sha256,
        fileSizeBytes: row.fileSizeBytes,
      },
    });

    return {
      fileName: `${row.number}.pdf`,
      mimeType: row.mimeType,
      content: Buffer.from(row.content),
      sha256: row.sha256,
    };
  }

  async registerPhysicalSignature(
    tenant: TenantContext,
    id: string,
    dto: RegisterPhysicalSignatureDto,
  ): Promise<Record<string, unknown>> {
    const propertyId = this.requireProperty(tenant);
    const existing = await this.prisma.generatedDocument.findFirst({
      where: { id, organizationId: tenant.organizationId, propertyId },
      select: { id: true, status: true, generatedAt: true },
    });
    if (existing === null) {
      throw new NotFoundException({
        code: 'document_not_found',
        message: 'Document not found in the current property.',
      });
    }
    if (existing.status === 'SIGNATURE_RECEIVED') {
      return this.get(tenant, id);
    }
    if (existing.status === 'VOIDED') {
      throw new ConflictException({
        code: 'document_voided',
        message: 'A voided document cannot receive a physical signature.',
      });
    }

    const now = this.clock.now();
    const receivedAt = dto.receivedAt !== undefined ? new Date(dto.receivedAt) : now;
    if (Number.isNaN(receivedAt.getTime())) {
      throw new BadRequestException({
        code: 'invalid_received_at',
        message: 'receivedAt must be a valid ISO 8601 instant.',
      });
    }
    if (receivedAt.getTime() > now.getTime() + 5 * 60_000) {
      throw new BadRequestException({
        code: 'received_at_in_future',
        message: 'The physical signature cannot be received in the future.',
      });
    }
    if (receivedAt.getTime() < existing.generatedAt.getTime() - 5 * 60_000) {
      throw new BadRequestException({
        code: 'received_at_before_generation',
        message: 'The physical signature cannot predate the generated document.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.generatedDocument.update({
        where: { id },
        data: {
          status: 'SIGNATURE_RECEIVED',
          receivedAt,
          receivedById: tenant.actor.id,
          receivedNotes: dto.notes ?? null,
        },
        select: DOCUMENT_METADATA_SELECT,
      });
      await this.audit.append(
        {
          organizationId: tenant.organizationId,
          propertyId,
          actorUserId: tenant.actor.id,
          action: 'document.physical_signature_received',
          entityType: 'GeneratedDocument',
          entityId: id,
          correlationId: tenant.correlationId,
          metadata: {
            documentType: row.documentType,
            receivedAt: receivedAt.toISOString(),
          },
        },
        tx,
      );
      return row;
    });

    return serializeMetadata(updated);
  }

  async createPrintEvent(
    tenant: TenantContext,
    id: string,
    dto: CreatePrintEventDto,
  ): Promise<Record<string, unknown>> {
    const propertyId = this.requireProperty(tenant);
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, organizationId: tenant.organizationId, propertyId },
      select: { id: true, documentType: true },
    });
    if (document === null) {
      throw new NotFoundException({
        code: 'document_not_found',
        message: 'Document not found in the current property.',
      });
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentPrintEvent.create({
        data: {
          organizationId: tenant.organizationId,
          propertyId,
          documentId: id,
          type: dto.type,
          requestedById: tenant.actor.id,
          note: dto.note ?? null,
        },
        select: {
          id: true,
          type: true,
          requestedAt: true,
          note: true,
          requestedBy: { select: { id: true, name: true } },
        },
      });
      await this.audit.append(
        {
          organizationId: tenant.organizationId,
          propertyId,
          actorUserId: tenant.actor.id,
          action: 'document.print_event_recorded',
          entityType: 'GeneratedDocument',
          entityId: id,
          correlationId: tenant.correlationId,
          metadata: { type: dto.type },
        },
        tx,
      );
      return created;
    });

    return event;
  }

  private requireProperty(tenant: TenantContext): string {
    if (tenant.propertyId === undefined) {
      throw new BadRequestException({
        code: 'property_context_required',
        message: 'Documents require property context.',
      });
    }
    return tenant.propertyId;
  }

  private nextNumber(id: string, generatedAt: Date, timezone: string): string {
    const date = calendarDateInTimezone(generatedAt, timezone).replaceAll('-', '');
    return `DOC-${date}-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  }

  private buildContext(
    tenant: TenantContext,
    dto: DocumentSourceDto & { type: DocumentType },
    number: string | null,
    generatedAt: Date,
  ): Promise<{
    context: DocumentContext & { guestId: string };
    template: {
      id: string;
      key: string;
      name: string;
      title: string;
      version: number;
      locale: string;
      body: string;
    };
  }> {
    return buildDocumentContext(
      this.prisma,
      tenant,
      this.requireProperty(tenant),
      dto,
      number,
      generatedAt,
    );
  }
}
