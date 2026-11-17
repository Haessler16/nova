import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FolioProductCategory, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { money, parseMoney } from '../common/money/decimal';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/product.dto';

const PRODUCT_SELECT = Prisma.validator<Prisma.FolioProductSelect>()({
  id: true,
  sku: true,
  name: true,
  description: true,
  category: true,
  unit: true,
  unitAmount: true,
  currencyCode: true,
  isActive: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
});

type ProductRow = Prisma.FolioProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

export interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: FolioProductCategory;
  unit: string;
  unitAmount: string;
  currencyCode: string;
  isActive: boolean;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapProduct(row: ProductRow): ProductResponse {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    unit: row.unit,
    unitAmount: money(row.unitAmount),
    currencyCode: row.currencyCode,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Property-scoped consumables catalog used by Caixa to post minibar, parking
 * and service charges. Prices are master data in DECIMAL(10,2) with an explicit
 * currency; folio lines keep a snapshot so later edits never rewrite accounts.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    context: TenantContext,
    query: ListProductsQueryDto,
  ): Promise<{ items: ProductResponse[] }> {
    const propertyId = requirePropertyContext(context);

    const where: Prisma.FolioProductWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };
    if (query.category !== undefined) {
      where.category = query.category;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    const search = query.search?.trim();
    if (search !== undefined && search !== '') {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.folioProduct.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      take: 200,
      select: PRODUCT_SELECT,
    });
    return { items: rows.map(mapProduct) };
  }

  async create(context: TenantContext, dto: CreateProductDto): Promise<ProductResponse> {
    const propertyId = requirePropertyContext(context);
    const property = await this.loadProperty(context.organizationId, propertyId);
    const currencyCode = dto.currencyCode ?? property.currencyCode;
    if (currencyCode !== property.currencyCode) {
      throw new BadRequestException({
        code: 'currency_mismatch',
        message: `This property uses ${property.currencyCode}.`,
      });
    }
    const unitAmount = parseMoney(dto.unitAmount, 'unitAmount');

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.folioProduct.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            sku: dto.sku,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? null,
            category: dto.category ?? FolioProductCategory.OTHER,
            unit: dto.unit ?? 'UN',
            unitAmount,
            currencyCode,
            isActive: dto.isActive ?? true,
            createdByUserId: context.actor.id,
            updatedByUserId: context.actor.id,
          },
          select: PRODUCT_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'catalog.product_created',
            entityType: 'FolioProduct',
            entityId: product.id,
            correlationId: context.correlationId,
            metadata: {
              sku: product.sku,
              name: product.name,
              category: product.category,
              unitAmount: money(product.unitAmount),
              currencyCode: product.currencyCode,
            },
          },
          transaction,
        );

        return mapProduct(product);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'product_sku_exists',
          message: 'A product with this SKU already exists in this property.',
          details: { sku: dto.sku },
        });
      }
      throw error;
    }
  }

  async update(
    context: TenantContext,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.folioProduct.findFirst({
        where: { id: productId, organizationId: context.organizationId, propertyId },
        select: PRODUCT_SELECT,
      });
      if (current === null) {
        throw new NotFoundException({
          code: 'product_not_found',
          message: 'Product not found in this property.',
        });
      }

      const property = await this.loadProperty(context.organizationId, propertyId);
      if (dto.currencyCode !== undefined && dto.currencyCode !== property.currencyCode) {
        throw new BadRequestException({
          code: 'currency_mismatch',
          message: `This property uses ${property.currencyCode}.`,
        });
      }

      const data: Prisma.FolioProductUpdateInput = {
        updatedBy: { connect: { id: context.actor.id } },
      };
      if (dto.name !== undefined) {
        data.name = dto.name.trim();
      }
      if (dto.description !== undefined) {
        data.description = dto.description.trim() === '' ? null : dto.description.trim();
      }
      if (dto.category !== undefined) {
        data.category = dto.category;
      }
      if (dto.unit !== undefined) {
        data.unit = dto.unit;
      }
      if (dto.unitAmount !== undefined) {
        data.unitAmount = parseMoney(dto.unitAmount, 'unitAmount');
      }
      if (dto.currencyCode !== undefined) {
        data.currencyCode = dto.currencyCode;
      }
      if (dto.isActive !== undefined) {
        data.isActive = dto.isActive;
      }

      const updated = await transaction.folioProduct.update({
        where: { id: productId },
        data,
        select: PRODUCT_SELECT,
      });

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (dto.name !== undefined && updated.name !== current.name) {
        changes.name = { from: current.name, to: updated.name };
      }
      if (dto.category !== undefined && updated.category !== current.category) {
        changes.category = { from: current.category, to: updated.category };
      }
      if (dto.unit !== undefined && updated.unit !== current.unit) {
        changes.unit = { from: current.unit, to: updated.unit };
      }
      if (dto.unitAmount !== undefined && !updated.unitAmount.equals(current.unitAmount)) {
        changes.unitAmount = {
          from: money(current.unitAmount),
          to: money(updated.unitAmount),
        };
      }
      if (dto.isActive !== undefined && updated.isActive !== current.isActive) {
        changes.isActive = { from: current.isActive, to: updated.isActive };
      }

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'catalog.product_updated',
          entityType: 'FolioProduct',
          entityId: updated.id,
          correlationId: context.correlationId,
          metadata: { sku: updated.sku, changes },
        },
        transaction,
      );

      return mapProduct(updated);
    });
  }

  private async loadProperty(
    organizationId: string,
    propertyId: string,
  ): Promise<{ currencyCode: string }> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { currencyCode: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in this organization.',
      });
    }
    return property;
  }
}
