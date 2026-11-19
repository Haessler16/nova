import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PropertySettings {
  id: string;
  timezone: string;
  operationalDayStart: string;
}

/**
 * Loads the property that scopes a front-office operation and exposes only the
 * settings the operational day needs. Every read is tenant-scoped: the caller
 * passes the organization resolved on the server, never a client value.
 */
@Injectable()
export class PropertyLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(organizationId: string, propertyId: string): Promise<PropertySettings> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        timezone: true,
        operationalDayStart: true,
      },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found.',
      });
    }
    return property;
  }
}
