import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { PERMISSIONS } from '../access/permissions';
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

interface RoleSummary {
  key: string;
  name: string;
}

interface PropertyAccessSummary {
  id: string;
  name: string;
  code: string;
  role: RoleSummary | null;
}

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves an immutable server-side tenant context. Client-provided ids are
   * selectors only: every selector is validated against active memberships.
   *
   * Organization-role permissions are additive. If the organization role
   * grants `property.read`, the user can access every active property in the
   * organization even without a per-property membership (ORG_ADMIN case).
   * Regular property staff keep `Membership.roleId = null`.
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
      select: {
        id: true,
        roleId: true,
        role: {
          select: {
            permissions: {
              select: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });

    if (membership === null) {
      throw new ForbiddenException({
        code: 'organization_access_denied',
        message: 'You do not have access to this organization.',
      });
    }

    const organizationPermissions = new Set(
      membership.role?.permissions.map((rolePermission) => rolePermission.permission.key) ?? [],
    );

    let propertyRoleId: string | undefined;
    let propertyPermissions: string[] = [];

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
          roleId: true,
          role: {
            select: {
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      });

      const organizationWideAccess = organizationPermissions.has(PERMISSIONS.PROPERTY_READ);

      if (propertyMembership === null && !organizationWideAccess) {
        throw new ForbiddenException({
          code: 'property_access_denied',
          message: 'You do not have access to this property.',
        });
      }

      propertyRoleId = propertyMembership?.roleId;
      propertyPermissions =
        propertyMembership?.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ) ?? [];
    }

    return Object.freeze({
      organizationId,
      propertyId,
      organizationRoleId: membership.roleId ?? undefined,
      propertyRoleId,
      actor,
      permissions: new Set([...organizationPermissions, ...propertyPermissions]),
      organizationPermissions: Object.freeze(
        new Set(organizationPermissions),
      ) as ReadonlySet<string>,
      correlationId,
    });
  }

  async listOrganizationsForUser(
    actorId: string,
  ): Promise<Array<OrganizationSummary & { membershipId: string; role: RoleSummary | null }>> {
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
        role: { select: { key: true, name: true } },
      },
      orderBy: { organization: { name: 'asc' } },
    });

    return memberships.map((membership) => ({
      ...membership.organization,
      membershipId: membership.id,
      role: membership.role,
    }));
  }

  async listPropertiesForContext(context: TenantContext): Promise<PropertySummary[]> {
    const propertySelect = {
      id: true,
      name: true,
      code: true,
      timezone: true,
      currencyCode: true,
      operationalDayStart: true,
      status: true,
    } as const;

    if (context.organizationPermissions.has(PERMISSIONS.PROPERTY_READ)) {
      return this.prisma.property.findMany({
        where: {
          organizationId: context.organizationId,
          status: RecordStatus.ACTIVE,
        },
        select: propertySelect,
        orderBy: { name: 'asc' },
      });
    }

    const memberships = await this.prisma.propertyMembership.findMany({
      where: {
        organizationId: context.organizationId,
        userId: context.actor.id,
        status: RecordStatus.ACTIVE,
        property: { status: RecordStatus.ACTIVE },
      },
      select: {
        property: { select: propertySelect },
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
      role: RoleSummary | null;
      properties: PropertyAccessSummary[];
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
            role: {
              select: {
                key: true,
                name: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
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

    const memberships = await Promise.all(
      user.memberships.map(async (membership) => {
        const organizationWideAccess =
          membership.role?.permissions.some(
            (rolePermission) => rolePermission.permission.key === PERMISSIONS.PROPERTY_READ,
          ) ?? false;

        if (organizationWideAccess) {
          const properties = await this.prisma.property.findMany({
            where: {
              organizationId: membership.organizationId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
          });

          return {
            organization: membership.organization,
            role:
              membership.role === null
                ? null
                : { key: membership.role.key, name: membership.role.name },
            properties: properties.map((property) => ({ ...property, role: null })),
          };
        }

        return {
          organization: membership.organization,
          role:
            membership.role === null
              ? null
              : { key: membership.role.key, name: membership.role.name },
          properties: user.propertyMemberships
            .filter(
              (propertyMembership) =>
                propertyMembership.organizationId === membership.organizationId,
            )
            .map((propertyMembership) => ({
              ...propertyMembership.property,
              role: propertyMembership.role,
            })),
        };
      }),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships,
    };
  }
}
