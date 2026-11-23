import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_TYPE_LABELS,
  signatureRequired,
  type DocumentContext,
  type DocumentType,
} from './document-context';
import type { DocumentSourceDto } from './dto/document.dto';

export const DOCUMENT_METADATA_SELECT = {
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

export type DocumentMetadataRow = Prisma.GeneratedDocumentGetPayload<{
  select: typeof DOCUMENT_METADATA_SELECT;
}>;

/**
 * Documents never expose a full guest document number: the PDF and the API
 * metadata keep only the last four characters.
 */
export function maskDocumentNumber(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) {
    return '••••';
  }
  return `${'•'.repeat(Math.min(8, compact.length - 4))} ${compact.slice(-4)}`;
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function serializeMetadata(row: DocumentMetadataRow): Record<string, unknown> {
  const { _count, ...rest } = row;
  return { ...rest, printEventCount: _count.printEvents };
}

export interface DocumentTemplateRow {
  id: string;
  key: string;
  name: string;
  title: string;
  version: number;
  locale: string;
  body: string;
}

/**
 * Loads the reservation that scopes a document and rejects states that cannot
 * produce one. `tenant` is resolved on the server; the property is re-read to
 * keep the document bound to its own settings.
 */
async function loadReservation(
  prisma: PrismaService,
  tenant: TenantContext,
  propertyId: string,
  dto: DocumentSourceDto & { type: DocumentType },
): Promise<{
  property: {
    id: string;
    name: string;
    code: string;
    timezone: string;
    currencyCode: string;
  };
  reservation: {
    id: string;
    guestId: string;
    code: string;
    status: string;
    checkInDate: Date;
    checkOutDate: Date;
    adults: number;
    children: number;
    guest: {
      id: string;
      fullName: string;
      documentType: string | null;
      documentNumber: string | null;
      email: string | null;
      phone: string | null;
    };
    roomType: { name: string };
    room: { number: string } | null;
    stay: {
      id: string;
      status: string;
      checkedInAt: Date;
      checkedOutAt: Date | null;
    } | null;
  };
}> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: tenant.organizationId },
    select: { id: true, name: true, code: true, timezone: true, currencyCode: true },
  });
  if (property === null) {
    throw new NotFoundException({
      code: 'property_not_found',
      message: 'Property not found in the current organization.',
    });
  }

  const reservation = await prisma.reservation.findFirst({
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

  return { property, reservation };
}

async function loadTemplate(
  prisma: PrismaService,
  tenant: TenantContext,
  propertyId: string,
  dto: DocumentSourceDto & { type: DocumentType },
): Promise<DocumentTemplateRow> {
  const template = await prisma.documentTemplate.findFirst({
    where: {
      organizationId: tenant.organizationId,
      propertyId,
      key: dto.type,
      locale: dto.locale ?? 'pt-BR',
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
  return template;
}

/**
 * Builds the immutable render context once, so the HTML preview and the PDF use
 * exactly the same data. The template body is plain text, never HTML.
 */
export async function buildDocumentContext(
  prisma: PrismaService,
  tenant: TenantContext,
  propertyId: string,
  dto: DocumentSourceDto & { type: DocumentType },
  number: string | null,
  generatedAt: Date,
): Promise<{ context: DocumentContext & { guestId: string }; template: DocumentTemplateRow }> {
  const { property, reservation } = await loadReservation(prisma, tenant, propertyId, dto);
  const nights = Math.max(
    1,
    Math.round(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86_400_000,
    ),
  );
  const template = await loadTemplate(prisma, tenant, propertyId, dto);

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
