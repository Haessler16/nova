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
import { calendarDateInTimezone } from '../common/time/property-day';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_TYPE_LABELS,
  signatureRequired,
  type DocumentContext,
  type DocumentType,
} from './document-context';
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

const metadataSelect = {
  id: true,
  number: true,
  documentType: true,
  status: true,
  locale: true,
  templateVersion: true,
  guestId: true,
  reservationId: true,
  stayId: true,
  generatedAt: true,
  mimeType: true,
  fileSizeBytes: true,
  pageCount: true,
  sha256: true,
  receivedAt: true,
  receivedNotes: true,
  createdAt: true,
  template: { select: { id: true, key: true, name: true, version: true, locale: true } },
  generatedBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  _count: { select: { printEvents: true } },
} satisfies Prisma.GeneratedDocumentSelect;

type DocumentMetadataRow = Prisma.GeneratedDocumentGetPayload<{ select: typeof metadataSelect }>;

function maskDocumentNumber(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) {
    return '••••';
  }
  return `${'•'.repeat(Math.min(8, compact.length - 4))} ${compact.slice(-4)}`;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function serializeMetadata(row: DocumentMetadataRow): Record<string, unknown> {
  const { _count, ...rest } = row;
  return { ...rest, printEventCount: _count.printEvents };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    const generatedAt = new Date();
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
    const generatedAt = new Date();
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
        select: metadataSelect,
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
      select: metadataSelect,
    });

    return { items: rows.map(serializeMetadata) };
  }

  async get(tenant: TenantContext, id: string): Promise<Record<string, unknown>> {
    const propertyId = this.requireProperty(tenant);
    const row = await this.prisma.generatedDocument.findFirst({
      where: { id, organizationId: tenant.organizationId, propertyId },
      select: {
        ...metadataSelect,
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

    const now = new Date();
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
        select: metadataSelect,
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

  private async buildContext(
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
    const propertyId = this.requireProperty(tenant);
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: tenant.organizationId },
      select: { id: true, name: true, code: true, timezone: true, currencyCode: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the current organization.',
      });
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: dto.reservationId,
        organizationId: tenant.organizationId,
        propertyId,
      },
      select: {
        id: true,
        guestId: true,
        code: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        adults: true,
        children: true,
        guest: {
          select: {
            id: true,
            fullName: true,
            documentType: true,
            documentNumber: true,
            email: true,
            phone: true,
          },
        },
        roomType: { select: { name: true } },
        room: { select: { number: true } },
        stay: {
          select: { id: true, status: true, checkedInAt: true, checkedOutAt: true },
        },
      },
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the current property.',
      });
    }
    const nights = Math.max(
      1,
      Math.round(
        (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86_400_000,
      ),
    );
    if (dto.guestId !== undefined && dto.guestId !== reservation.guestId) {
      throw new BadRequestException({
        code: 'document_guest_mismatch',
        message: 'The selected guest does not belong to this reservation.',
      });
    }
    if (reservation.status === 'CANCELLED' || reservation.status === 'NO_SHOW') {
      throw new ConflictException({
        code: 'document_reservation_state_invalid',
        message: 'Documents cannot be generated for a cancelled or no-show reservation.',
      });
    }
    if (dto.type === 'CHECKIN_SUMMARY' && reservation.stay === null) {
      throw new ConflictException({
        code: 'document_checkin_required',
        message: 'A check-in summary requires an existing stay.',
      });
    }

    const locale = dto.locale ?? 'pt-BR';
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        organizationId: tenant.organizationId,
        propertyId,
        key: dto.type,
        locale,
        isPublished: true,
        isActive: true,
        ...(dto.templateId !== undefined ? { id: dto.templateId } : {}),
      },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        key: true,
        name: true,
        title: true,
        version: true,
        locale: true,
        body: true,
      },
    });
    if (template === null) {
      throw new NotFoundException({
        code: 'document_template_not_found',
        message: 'No published document template matches this property and type.',
      });
    }

    const context: DocumentContext & { guestId: string } = {
      schemaVersion: 1,
      document: {
        number,
        type: dto.type,
        typeLabel: DOCUMENT_TYPE_LABELS[dto.type],
        title: template.title,
        locale: template.locale as DocumentContext['document']['locale'],
        templateVersion: template.version,
        generatedAt: generatedAt.toISOString(),
      },
      template: {
        id: template.id,
        key: template.key as DocumentType,
        version: template.version,
        title: template.title,
        body: template.body,
      },
      property,
      guest: {
        fullName: reservation.guest.fullName,
        documentType: reservation.guest.documentType,
        documentNumberMasked: maskDocumentNumber(reservation.guest.documentNumber),
        email: reservation.guest.email,
        phone: reservation.guest.phone,
      },
      reservation: {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        checkInDate: isoDate(reservation.checkInDate),
        checkOutDate: isoDate(reservation.checkOutDate),
        nights,
        adults: reservation.adults,
        children: reservation.children,
        roomType: reservation.roomType.name,
        roomNumber: reservation.room?.number ?? null,
      },
      stay:
        reservation.stay === null
          ? null
          : {
              id: reservation.stay.id,
              status: reservation.stay.status,
              checkedInAt: reservation.stay.checkedInAt.toISOString(),
              checkedOutAt: reservation.stay.checkedOutAt?.toISOString() ?? null,
            },
      signatureRequired: signatureRequired(dto.type),
      guestId: reservation.guestId,
    };

    return { context, template };
  }
}
