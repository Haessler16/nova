import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { PERMISSIONS } from '../access/permissions';
import type { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';

/** Administration is organization-scoped; property context is rejected. */
export function organizationActorPermissions(context: TenantContext): ReadonlySet<string> {
  if (context.propertyId !== undefined) {
    throw new ForbiddenException({
      code: 'organization_context_required',
      message: 'Administration endpoints require organization-level context.',
    });
  }
  return context.organizationPermissions;
}

/** Shared authorization guards for memberships and roles. */
@Injectable()
export class AdminGuards {
  constructor(private readonly prisma: PrismaService) {}

  assertPermissionSubset(
    requested: readonly string[],
    actorPermissions: ReadonlySet<string>,
  ): void {
    const missing = requested.filter((permission) => !actorPermissions.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'permission_escalation_denied',
        message: 'You cannot grant permissions that your own organization role does not hold.',
        details: { forbiddenPermissions: missing },
      });
    }
  }

  async assertRoleSubset(
    organizationId: string,
    roleId: string,
    actorPermissions: ReadonlySet<string>,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
      select: {
        id: true,
        key: true,
        name: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    if (role === null) {
      throw new NotFoundException({
        code: 'role_not_found',
        message: 'Role not found in the selected organization.',
      });
    }

    this.assertPermissionSubset(
      role.permissions.map((rolePermission) => rolePermission.permission.key),
      actorPermissions,
    );
    return role;
  }

  async assertProperty(organizationId: string, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { id: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the selected organization.',
      });
    }
  }

  async assertOrganizationMember(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, status: RecordStatus.ACTIVE },
      select: { id: true },
    });
    if (membership === null) {
      throw new BadRequestException({
        code: 'organization_membership_required',
        message: 'The user must have an active organization membership first.',
      });
    }
  }

  async assertLastAdminGuard(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    input: {
      membershipId: string;
      currentStatus: RecordStatus;
      currentRoleId: string | null;
      nextStatus: RecordStatus;
      nextRoleId: string | null;
    },
  ): Promise<void> {
    const wasAdmin = await this.roleGrantsAdmin(
      transaction,
      organizationId,
      input.currentRoleId,
      input.currentStatus,
    );
    const willBeAdmin = await this.roleGrantsAdmin(
      transaction,
      organizationId,
      input.nextRoleId,
      input.nextStatus,
    );

    if (!wasAdmin || willBeAdmin) {
      return;
    }

    const remaining = await transaction.membership.count({
      where: {
        organizationId,
        status: RecordStatus.ACTIVE,
        id: { not: input.membershipId },
        role: {
          permissions: {
            some: { permission: { key: PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE } },
          },
        },
      },
    });

    if (remaining === 0) {
      throw new ConflictException({
        code: 'last_organization_admin',
        message:
          'This change would remove the last active administrator who can manage memberships.',
      });
    }
  }

  async assertRoleUpdateKeepsAdmin(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    roleId: string,
    input: { beforePermissions: string[]; afterPermissions: string[] },
  ): Promise<void> {
    const permission = PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE;
    if (
      !input.beforePermissions.includes(permission) ||
      input.afterPermissions.includes(permission)
    ) {
      return;
    }

    const affectedAdmins = await transaction.membership.count({
      where: { organizationId, status: RecordStatus.ACTIVE, roleId },
    });
    const otherAdmins = await transaction.membership.count({
      where: {
        organizationId,
        status: RecordStatus.ACTIVE,
        roleId: { not: roleId },
        role: { permissions: { some: { permission: { key: permission } } } },
      },
    });

    if (affectedAdmins > 0 && otherAdmins === 0) {
      throw new ConflictException({
        code: 'last_organization_admin',
        message: 'This role change would leave the organization without an administrator.',
      });
    }
  }

  async permissionIds(
    transaction: Prisma.TransactionClient,
    permissionKeys: readonly string[],
  ): Promise<string[]> {
    const permissions = await transaction.permission.findMany({
      where: { key: { in: [...permissionKeys] } },
      select: { id: true, key: true },
    });

    if (permissions.length !== permissionKeys.length) {
      const found = new Set(permissions.map((permission) => permission.key));
      throw new BadRequestException({
        code: 'unknown_permission',
        message: 'One or more permissions are not registered in the database.',
        details: { unknown: permissionKeys.filter((key) => !found.has(key)) },
      });
    }

    return permissions.map((permission) => permission.id);
  }

  private async roleGrantsAdmin(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    roleId: string | null,
    status: RecordStatus,
  ): Promise<boolean> {
    if (roleId === null || status !== RecordStatus.ACTIVE) {
      return false;
    }
    const role = await transaction.role.findFirst({
      where: {
        id: roleId,
        organizationId,
        permissions: {
          some: { permission: { key: PERMISSIONS.ORGANIZATION_MEMBERS_MANAGE } },
        },
      },
      select: { id: true },
    });
    return role !== null;
  }
}
