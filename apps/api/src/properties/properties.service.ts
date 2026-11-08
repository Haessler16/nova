import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';

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

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(context: TenantContext, dto: CreatePropertyDto): Promise<PropertyResponse> {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();

    try {
      const property = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.property.create({
          data: {
            organizationId: context.organizationId,
            name,
            code,
            timezone: dto.timezone,
            currencyCode: dto.currencyCode,
            operationalDayStart: dto.operationalDayStart,
          },
          select: {
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
          },
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

      return property;
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
}
