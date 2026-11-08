import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { AuthenticatedActor, TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';

export interface PropertySummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
  currencyCode: string;
  operationalDayStart: string;
  status: RecordStatus;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: RecordStatus;
}

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves an immutable server-side tenant context. Client-provided ids are
   * selectors only: every selector is validated against active memberships.
   *
   * Denials deliberately do not reveal whether an organization exists.
   */
  async resolveContext(
    actor: AuthenticatedActor,
    organizationId: string,
    propertyId: string | undefined,
    correlationId: string,
  ): Promise<TenantContext> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: actor.id,
        status: RecordStatus.ACTIVE,
        organization: { status: RecordStatus.ACTIVE },
      },
      select: { id: true },
    });

    if (membership === null) {
      throw new ForbiddenException({
        code: 'organization_access_denied',
        message: 'You do not have access to this organization.',
      });
    }

    let permissions: string[] = [];

    if (propertyId !== undefined) {
      const property = await this.prisma.property.findFirst({
        where: {
          id: propertyId,
          organizationId,
          status: RecordStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (property === null) {
        throw new NotFoundException({
          code: 'property_not_found',
          message: 'Property not found in the selected organization.',
        });
      }

      const propertyMembership = await this.prisma.propertyMembership.findFirst({
        where: {
          organizationId,
          propertyId,
          userId: actor.id,
          status: RecordStatus.ACTIVE,
        },
        select: {
          role: {
            select: {
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      });

      if (propertyMembership === null) {
        throw new ForbiddenException({
          code: 'property_access_denied',
          message: 'You do not have access to this property.',
        });
      }

      permissions = propertyMembership.role.permissions.map(
        (rolePermission) => rolePermission.permission.key,
      );
    }

    return Object.freeze({
      organizationId,
      propertyId,
      actor,
      permissions: new Set(permissions),
      correlationId,
    });
  }

  async listOrganizationsForUser(
    actorId: string,
  ): Promise<Array<OrganizationSummary & { membershipId: string }>> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: actorId,
        status: RecordStatus.ACTIVE,
        organization: { status: RecordStatus.ACTIVE },
      },
      select: {
        id: true,
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
      orderBy: { organization: { name: 'asc' } },
    });

    return memberships.map((membership) => ({
      ...membership.organization,
      membershipId: membership.id,
    }));
  }

  async listPropertiesForContext(context: TenantContext): Promise<PropertySummary[]> {
    const memberships = await this.prisma.propertyMembership.findMany({
      where: {
        organizationId: context.organizationId,
        userId: context.actor.id,
        status: RecordStatus.ACTIVE,
        property: { status: RecordStatus.ACTIVE },
      },
      select: {
        property: {
          select: {
            id: true,
            name: true,
            code: true,
            timezone: true,
            currencyCode: true,
            operationalDayStart: true,
            status: true,
          },
        },
      },
    });

    return memberships
      .map((membership) => membership.property)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getMe(actor: AuthenticatedActor): Promise<{
    id: string;
    email: string;
    name: string;
    memberships: Array<{
      organization: OrganizationSummary;
      properties: Array<{
        id: string;
        name: string;
        code: string;
        role: { key: string; name: string };
      }>;
    }>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          where: {
            status: RecordStatus.ACTIVE,
            organization: { status: RecordStatus.ACTIVE },
          },
          select: {
            organization: {
              select: { id: true, name: true, slug: true, status: true },
            },
            organizationId: true,
          },
        },
        propertyMemberships: {
          where: {
            status: RecordStatus.ACTIVE,
            property: { status: RecordStatus.ACTIVE },
          },
          select: {
            organizationId: true,
            property: { select: { id: true, name: true, code: true } },
            role: { select: { key: true, name: true } },
          },
        },
      },
    });

    if (user === null) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'User not found.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((membership) => ({
        organization: membership.organization,
        properties: user.propertyMemberships
          .filter(
            (propertyMembership) => propertyMembership.organizationId === membership.organizationId,
          )
          .map((propertyMembership) => ({
            id: propertyMembership.property.id,
            name: propertyMembership.property.name,
            code: propertyMembership.property.code,
            role: propertyMembership.role,
          })),
      })),
    };
  }
}
