import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertySettingsDto } from './dto/update-property-settings.dto';

export interface PropertyResponse {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  timezone: string;
  currencyCode: string;
  operationalDayStart: string;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PROPERTY_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  code: true,
  timezone: true,
  currencyCode: true,
  operationalDayStart: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(context: TenantContext, dto: CreatePropertyDto): Promise<PropertyResponse> {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const roleId = context.organizationRoleId ?? context.propertyRoleId;

    if (roleId === undefined) {
      throw new ForbiddenException({
        code: 'property_role_required',
        message: 'An organization or property role is required to create properties.',
      });
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.property.create({
          data: {
            organizationId: context.organizationId,
            name,
            code,
            timezone: dto.timezone,
            currencyCode: dto.currencyCode,
            operationalDayStart: dto.operationalDayStart,
          },
          select: PROPERTY_SELECT,
        });

        // The creator must be able to operate the property they just created.
        // The composite FK in migration 20261108120000 validates the role's
        // organization and the existing organization membership.
        await transaction.propertyMembership.create({
          data: {
            organizationId: context.organizationId,
            propertyId: created.id,
            userId: context.actor.id,
            roleId,
          },
          select: { id: true },
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            // propertyId is the authorization scope in which the action ran.
            // The created property is identified by entityType/entityId.
            propertyId: context.propertyId,
            actorUserId: context.actor.id,
            action: 'property.created',
            entityType: 'Property',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: { code: created.code, name: created.name },
          },
          transaction,
        );

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'property_code_conflict',
          message: 'A property with this code already exists in the organization.',
        });
      }
      throw error;
    }
  }

  async getCurrent(context: TenantContext): Promise<PropertyResponse> {
    const propertyId = this.requireProperty(context);
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId: context.organizationId,
        status: RecordStatus.ACTIVE,
      },
      select: PROPERTY_SELECT,
    });

    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found.',
      });
    }

    return property;
  }

  async updateSettings(
    context: TenantContext,
    dto: UpdatePropertySettingsDto,
  ): Promise<PropertyResponse> {
    const propertyId = this.requireProperty(context);
    const data: Prisma.PropertyUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.timezone !== undefined) {
      data.timezone = dto.timezone;
    }
    if (dto.currencyCode !== undefined) {
      data.currencyCode = dto.currencyCode;
    }
    if (dto.operationalDayStart !== undefined) {
      data.operationalDayStart = dto.operationalDayStart;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'empty_update',
        message: 'At least one property setting must be provided.',
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.property.findFirst({
        where: {
          id: propertyId,
          organizationId: context.organizationId,
          status: RecordStatus.ACTIVE,
        },
        select: PROPERTY_SELECT,
      });

      if (before === null) {
        throw new NotFoundException({
          code: 'property_not_found',
          message: 'Property not found.',
        });
      }

      const updated = await transaction.property.update({
        where: { id: propertyId },
        data,
        select: PROPERTY_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'property.settings_updated',
          entityType: 'Property',
          entityId: propertyId,
          correlationId: context.correlationId,
          metadata: {
            before: {
              name: before.name,
              timezone: before.timezone,
              currencyCode: before.currencyCode,
              operationalDayStart: before.operationalDayStart,
            },
            after: {
              name: updated.name,
              timezone: updated.timezone,
              currencyCode: updated.currencyCode,
              operationalDayStart: updated.operationalDayStart,
            },
          },
        },
        transaction,
      );

      return updated;
    });
  }

  private requireProperty(context: TenantContext): string {
    if (context.propertyId === undefined) {
      throw new BadRequestException({
        code: 'property_context_required',
        message: 'This operation requires property context.',
      });
    }
    return context.propertyId;
  }
}
