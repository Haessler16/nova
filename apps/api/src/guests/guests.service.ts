import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto, ListGuestsQueryDto, UpdateGuestDto } from './dto/guest.dto';

export interface GuestResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

const GUEST_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  fullName: true,
  email: true,
  phone: true,
  documentType: true,
  documentNumber: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Guest profiles are property-scoped and minimized: no birth date, address or
 * identity documents beyond an optional document type/number. Search never
 * merges profiles automatically; duplicates stay visible for human review.
 */
@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    context: TenantContext,
    query: ListGuestsQueryDto,
  ): Promise<{ items: GuestResponse[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    const take = Math.min(query.limit ?? 50, 100);

    const where: Prisma.GuestWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.guest.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: GUEST_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async get(context: TenantContext, guestId: string): Promise<GuestResponse> {
    const propertyId = requirePropertyContext(context);

    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId: context.organizationId, propertyId },
      select: GUEST_SELECT,
    });

    if (guest === null) {
      throw new NotFoundException({
        code: 'guest_not_found',
        message: 'Guest not found in the selected property.',
      });
    }

    return guest;
  }

  async create(context: TenantContext, dto: CreateGuestDto): Promise<GuestResponse> {
    const propertyId = requirePropertyContext(context);
    this.assertDocumentPair(dto.documentType, dto.documentNumber);

    return this.prisma.$transaction(async (transaction) => {
      const created = await transaction.guest.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          fullName: dto.fullName.trim(),
          email: normalizeEmail(dto.email),
          phone: dto.phone?.trim(),
          documentType: dto.documentType,
          documentNumber: dto.documentNumber?.trim().toUpperCase(),
          notes: dto.notes?.trim(),
        },
        select: GUEST_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'guest.created',
          entityType: 'Guest',
          entityId: created.id,
          correlationId: context.correlationId,
          // Never copy contact or document data into the audit trail.
          metadata: { guestStatus: created.status },
        },
        transaction,
      );

      return created;
    });
  }

  async update(
    context: TenantContext,
    guestId: string,
    dto: UpdateGuestDto,
  ): Promise<GuestResponse> {
    const propertyId = requirePropertyContext(context);

    const existing = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId: context.organizationId, propertyId },
      select: { id: true, documentType: true, documentNumber: true },
    });

    if (existing === null) {
      throw new NotFoundException({
        code: 'guest_not_found',
        message: 'Guest not found in the selected property.',
      });
    }

    const nextDocumentType =
      dto.documentType !== undefined ? dto.documentType : existing.documentType;
    const nextDocumentNumber =
      dto.documentNumber !== undefined
        ? dto.documentNumber === null
          ? null
          : dto.documentNumber.trim().toUpperCase()
        : existing.documentNumber;
    this.assertDocumentPair(nextDocumentType, nextDocumentNumber);

    const data: Prisma.GuestUncheckedUpdateInput = {};
    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
    }
    if (dto.email !== undefined) {
      data.email = normalizeEmail(dto.email);
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone.trim();
    }
    if (dto.documentType !== undefined) {
      data.documentType = dto.documentType;
    }
    if (dto.documentNumber !== undefined) {
      data.documentNumber =
        dto.documentNumber === null ? null : dto.documentNumber.trim().toUpperCase();
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes.trim();
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return this.get(context, guestId);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.guest.update({
        where: { id: guestId },
        data,
        select: GUEST_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'guest.updated',
          entityType: 'Guest',
          entityId: guestId,
          correlationId: context.correlationId,
          metadata: {
            status: updated.status,
            fields: Object.keys(data),
          },
        },
        transaction,
      );

      return updated;
    });
  }

  private assertDocumentPair(
    documentType: string | null | undefined,
    documentNumber: string | null | undefined,
  ): void {
    const hasType = documentType !== undefined && documentType !== null;
    const hasNumber = documentNumber !== undefined && documentNumber !== null;
    if (hasType !== hasNumber) {
      throw new BadRequestException({
        code: 'invalid_guest_document',
        message: 'documentType and documentNumber must be provided together.',
      });
    }
  }
}

function normalizeEmail(email: string | undefined): string | null | undefined {
  if (email === undefined) {
    return undefined;
  }
  return email.trim().toLowerCase();
}
