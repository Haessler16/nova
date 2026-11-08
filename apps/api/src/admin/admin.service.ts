import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../access/permissions';
import { AuthRequestMetadata, AuthService, IssuedTokenResponse } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../security-events/security-event.service';
import { ListSecurityEventsQueryDto } from '../security-events/dto/list-security-events.dto';
import {
  CreateMembershipDto,
  CreatePropertyMembershipDto,
  CreateRoleDto,
  UpdateMembershipDto,
  UpdatePropertyMembershipDto,
  UpdateRoleDto,
} from './dto/admin.dto';

const MEMBERSHIP_SELECT = {
  id: true,
  organizationId: true,
  userId: true,
  roleId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true } },
  role: {
    select: {
      id: true,
      key: true,
      name: true,
      system: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  },
} as const;

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  system: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { memberships: true, propertyRoles: true } },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  // -------------------------------------------------------------------------
  // Organization memberships
  // -------------------------------------------------------------------------

  async listMemberships(context: TenantContext) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: context.organizationId },
      orderBy: [{ status: 'asc' }, { user: { name: 'asc' } }],
      take: 200,
      select: {
        ...MEMBERSHIP_SELECT,
        propertyMemberships: {
          where: { organizationId: context.organizationId },
          select: {
            id: true,
            propertyId: true,
            roleId: true,
            status: true,
            property: { select: { id: true, name: true, code: true } },
            role: { select: { id: true, key: true, name: true } },
          },
        },
      },
    });

    return {
      items: memberships.map((membership) => ({
        ...membership,
        role:
          membership.role === null
            ? null
            : {
                id: membership.role.id,
                key: membership.role.key,
                name: membership.role.name,
                system: membership.role.system,
                permissions: membership.role.permissions.map(
                  (rolePermission) => rolePermission.permission.key,
                ),
              },
      })),
    };
  }

  async createMembership(
    context: TenantContext,
    dto: CreateMembershipDto,
    metadata: AuthRequestMetadata,
  ): Promise<{ membership: unknown; invitation?: IssuedTokenResponse }> {
    const email = dto.email.trim().toLowerCase();
    const actorPermissions = this.actorPermissions(context);

    let roleId: string | null = null;
    if (dto.roleId !== undefined) {
      roleId = (await this.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions)).id;
    }

    const propertyAssignments = dto.propertyAssignments ?? [];
    for (const assignment of propertyAssignments) {
      await this.assertProperty(context.organizationId, assignment.propertyId);
      await this.assertRoleSubset(context.organizationId, assignment.roleId, actorPermissions);
    }

    let createdInvitationEmail: string | null = null;
    const membership = await this.prisma.$transaction(async (transaction) => {
      let user = await transaction.user.findUnique({
        where: { email },
        select: { id: true, status: true, passwordHash: true },
      });

      if (user?.status === RecordStatus.DISABLED) {
        throw new ConflictException({
          code: 'user_disabled',
          message: 'The user account is disabled. Reactivate the user before adding a membership.',
        });
      }

      if (user === null) {
        const localPart = email.split('@')[0] ?? 'User';
        user = await transaction.user.create({
          data: {
            email,
            name: dto.name?.trim() ?? localPart,
            status: RecordStatus.INVITED,
          },
          select: { id: true, status: true, passwordHash: true },
        });
        createdInvitationEmail = email;
      } else if (user.status === RecordStatus.INVITED || user.passwordHash === null) {
        createdInvitationEmail = email;
      }

      const existing = await transaction.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId: user.id,
          },
        },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictException({
          code: 'membership_exists',
          message: 'The user already has a membership in this organization.',
        });
      }

      const created = await transaction.membership.create({
        data: {
          organizationId: context.organizationId,
          userId: user.id,
          roleId,
          status: RecordStatus.ACTIVE,
        },
        select: MEMBERSHIP_SELECT,
      });

      for (const assignment of propertyAssignments) {
        const propertyMembership = await transaction.propertyMembership.findUnique({
          where: {
            propertyId_userId: { propertyId: assignment.propertyId, userId: user.id },
          },
          select: { id: true, organizationId: true },
        });

        if (propertyMembership !== null) {
          if (propertyMembership.organizationId !== context.organizationId) {
            throw new ConflictException({
              code: 'property_membership_conflict',
              message: 'The user already belongs to a property in another organization.',
            });
          }
          await transaction.propertyMembership.update({
            where: { id: propertyMembership.id },
            data: { roleId: assignment.roleId, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
        } else {
          await transaction.propertyMembership.create({
            data: {
              organizationId: context.organizationId,
              propertyId: assignment.propertyId,
              userId: user.id,
              roleId: assignment.roleId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true },
          });
        }
      }

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId: context.propertyId,
          actorUserId: context.actor.id,
          action: 'organization.membership_created',
          entityType: 'Membership',
          entityId: created.id,
          correlationId: context.correlationId,
          metadata: {
            userId: user.id,
            email,
            roleId,
            propertyAssignments: propertyAssignments.map((assignment) => ({
              propertyId: assignment.propertyId,
              roleId: assignment.roleId,
            })),
          },
        },
        transaction,
      );

      return created;
    });

    let invitation: IssuedTokenResponse | undefined;
    if (createdInvitationEmail !== null) {
      invitation = await this.auth.requestPasswordReset(createdInvitationEmail, metadata);
    }

    return { membership, invitation };
  }

  async updateMembership(
    context: TenantContext,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const actorPermissions = this.actorPermissions(context);

    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.membership.findFirst({
        where: { id: membershipId, organizationId: context.organizationId },
        select: MEMBERSHIP_SELECT,
      });

      if (before === null) {
        throw new NotFoundException({
          code: 'membership_not_found',
          message: 'Organization membership not found.',
        });
      }

      if (dto.removeRole === true && dto.roleId !== undefined) {
        throw new BadRequestException({
          code: 'ambiguous_role_update',
          message: 'Provide either roleId or removeRole, not both.',
        });
      }

      const nextRoleId =
        dto.removeRole === true ? null : dto.roleId !== undefined ? dto.roleId : before.roleId;
      const nextStatus = dto.status ?? before.status;

      if (nextRoleId !== null) {
        await this.assertRoleSubset(context.organizationId, nextRoleId, actorPermissions);
      }

      await this.assertLastAdminGuard(transaction, context.organizationId, {
        membershipId,
        currentStatus: before.status,
        currentRoleId: before.roleId,
        nextStatus,
        nextRoleId,
      });

      const updated = await transaction.membership.update({
        where: { id: membershipId },
        data: { roleId: nextRoleId, status: nextStatus },
        select: MEMBERSHIP_SELECT,
      });

      if (nextStatus !== RecordStatus.ACTIVE) {
        await transaction.session.updateMany({
          where: { userId: before.userId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'membership_deactivated' },
        });
      }

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId: context.propertyId,
          actorUserId: context.actor.id,
          action: 'organization.membership_updated',
          entityType: 'Membership',
          entityId: membershipId,
          correlationId: context.correlationId,
          metadata: {
            userId: before.userId,
            before: { roleId: before.roleId, status: before.status },
            after: { roleId: nextRoleId, status: nextStatus },
          },
        },
        transaction,
      );

      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Property memberships
  // -------------------------------------------------------------------------

  async listPropertyMemberships(context: TenantContext, propertyId: string) {
    await this.assertProperty(context.organizationId, propertyId);
    const items = await this.prisma.propertyMembership.findMany({
      where: { organizationId: context.organizationId, propertyId },
      orderBy: [{ status: 'asc' }, { user: { name: 'asc' } }],
      take: 200,
      select: {
        id: true,
        userId: true,
        roleId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true, status: true } },
        role: { select: { id: true, key: true, name: true, system: true } },
      },
    });
    return { items };
  }

  async createPropertyMembership(
    context: TenantContext,
    propertyId: string,
    dto: CreatePropertyMembershipDto,
  ) {
    const actorPermissions = this.actorPermissions(context);
    await this.assertProperty(context.organizationId, propertyId);
    await this.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions);
    await this.assertOrganizationMember(context.organizationId, dto.userId);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.propertyMembership.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            userId: dto.userId,
            roleId: dto.roleId,
            status: RecordStatus.ACTIVE,
          },
          select: {
            id: true,
            userId: true,
            propertyId: true,
            roleId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'property.membership_created',
            entityType: 'PropertyMembership',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: { userId: dto.userId, roleId: dto.roleId },
          },
          transaction,
        );

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'property_membership_exists',
          message: 'The user already has a membership in this property.',
        });
      }
      throw error;
    }
  }

  async updatePropertyMembership(
    context: TenantContext,
    propertyId: string,
    propertyMembershipId: string,
    dto: UpdatePropertyMembershipDto,
  ) {
    const actorPermissions = this.actorPermissions(context);
    await this.assertProperty(context.organizationId, propertyId);

    if (dto.roleId !== undefined) {
      await this.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions);
    }

    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.propertyMembership.findFirst({
        where: {
          id: propertyMembershipId,
          organizationId: context.organizationId,
          propertyId,
        },
        select: { id: true, userId: true, roleId: true, status: true },
      });

      if (before === null) {
        throw new NotFoundException({
          code: 'property_membership_not_found',
          message: 'Property membership not found.',
        });
      }

      const updated = await transaction.propertyMembership.update({
        where: { id: propertyMembershipId },
        data: {
          ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        select: {
          id: true,
          userId: true,
          propertyId: true,
          roleId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'property.membership_updated',
          entityType: 'PropertyMembership',
          entityId: propertyMembershipId,
          correlationId: context.correlationId,
          metadata: {
            userId: before.userId,
            before: { roleId: before.roleId, status: before.status },
            after: { roleId: updated.roleId, status: updated.status },
          },
        },
        transaction,
      );

      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------

  async listRoles(context: TenantContext) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: context.organizationId },
      orderBy: [{ system: 'desc' }, { name: 'asc' }],
      select: ROLE_SELECT,
    });

    return {
      items: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        system: role.system,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
        membershipCount: role._count.memberships,
        propertyMembershipCount: role._count.propertyRoles,
      })),
    };
  }

  async createRole(context: TenantContext, dto: CreateRoleDto) {
    const actorPermissions = this.actorPermissions(context);
    this.assertPermissionSubset(dto.permissions, actorPermissions);
    const key = dto.key.trim().toUpperCase();

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.role.create({
          data: {
            organizationId: context.organizationId,
            key,
            name: dto.name.trim(),
            system: false,
          },
          select: { id: true, key: true, name: true, system: true },
        });

        await transaction.rolePermission.createMany({
          data: (
            await this.permissionIds(transaction, dto.permissions)
          ).map((permissionId) => ({
            roleId: created.id,
            permissionId,
          })),
          skipDuplicates: true,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId: context.propertyId,
            actorUserId: context.actor.id,
            action: 'organization.role_created',
            entityType: 'Role',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: { key: created.key, name: created.name, permissions: dto.permissions },
          },
          transaction,
        );

        return { ...created, permissions: dto.permissions };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'role_key_conflict',
          message: 'A role with this key already exists in the organization.',
        });
      }
      throw error;
    }
  }

  async updateRole(context: TenantContext, roleId: string, dto: UpdateRoleDto) {
    const actorPermissions = this.actorPermissions(context);
    if (dto.permissions !== undefined) {
      this.assertPermissionSubset(dto.permissions, actorPermissions);
    }

    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.role.findFirst({
        where: { id: roleId, organizationId: context.organizationId },
        select: {
          id: true,
          key: true,
          name: true,
          system: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });

      if (before === null) {
        throw new NotFoundException({ code: 'role_not_found', message: 'Role not found.' });
      }
      if (before.system) {
        throw new ConflictException({
          code: 'system_role_immutable',
          message: 'System roles cannot be modified. Create a custom role instead.',
        });
      }

      const beforePermissions = before.permissions.map(
        (rolePermission) => rolePermission.permission.key,
      );
      if (dto.permissions !== undefined) {
        await this.assertRoleUpdateKeepsAdmin(transaction, context.organizationId, roleId, {
          beforePermissions,
          afterPermissions: dto.permissions,
        });
      }

      const updated = await transaction.role.update({
        where: { id: roleId },
        data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) },
        select: { id: true, key: true, name: true, system: true },
      });

      if (dto.permissions !== undefined) {
        await transaction.rolePermission.deleteMany({ where: { roleId } });
        if (dto.permissions.length > 0) {
          await transaction.rolePermission.createMany({
            data: (await this.permissionIds(transaction, dto.permissions)).map(
              (permissionId) => ({ roleId, permissionId }),
            ),
            skipDuplicates: true,
          });
        }
      }

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId: context.propertyId,
          actorUserId: context.actor.id,
          action: 'organization.role_updated',
          entityType: 'Role',
          entityId: roleId,
          correlationId: context.correlationId,
          metadata: {
            before: { name: before.name, permissions: beforePermissions },
            after: {
              name: updated.name,
              permissions: dto.permissions ?? beforePermissions,
            },
          },
        },
        transaction,
      );

      return { ...updated, permissions: dto.permissions ?? beforePermissions };
    });
  }

  // -------------------------------------------------------------------------
  // Sessions and security events
  // -------------------------------------------------------------------------

  async listMemberSessions(context: TenantContext, membershipId: string) {
    const membership = await this.requireMembership(context, membershipId);
    return { items: await this.sessions.listForUser(membership.userId) };
  }

  async revokeMemberSession(
    context: TenantContext,
    membershipId: string,
    sessionId: string,
  ): Promise<void> {
    const membership = await this.requireMembership(context, membershipId);
    const revoked = await this.sessions.revokeAnyForUser(
      membership.userId,
      sessionId,
      'admin_revoked',
    );
    if (!revoked) {
      throw new NotFoundException({
        code: 'session_not_found',
        message: 'Active session not found for this membership.',
      });
    }

    await this.securityEvents.safeRecord({
      type: 'auth.session_admin_revoked',
      severity: 'WARNING',
      organizationId: context.organizationId,
      userId: membership.userId,
      actorUserId: context.actor.id,
      correlationId: context.correlationId,
    });
  }

  async listSecurityEvents(context: TenantContext, query: ListSecurityEventsQueryDto) {
    return this.securityEvents.list(context, query);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private actorPermissions(context: TenantContext): ReadonlySet<string> {
    if (context.propertyId !== undefined) {
      throw new ForbiddenException({
        code: 'organization_context_required',
        message: 'Administration endpoints require organization-level context.',
      });
    }
    return context.organizationPermissions;
  }

  private assertPermissionSubset(
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

  private async assertRoleSubset(
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

  private async assertProperty(organizationId: string, propertyId: string): Promise<void> {
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

  private async assertOrganizationMember(
    organizationId: string,
    userId: string,
  ): Promise<void> {
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

  private async requireMembership(
    context: TenantContext,
    membershipId: string,
  ): Promise<{ id: string; userId: string }> {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: context.organizationId },
      select: { id: true, userId: true },
    });
    if (membership === null) {
      throw new NotFoundException({
        code: 'membership_not_found',
        message: 'Organization membership not found.',
      });
    }
    return membership;
  }

  private async assertLastAdminGuard(
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

  private async assertRoleUpdateKeepsAdmin(
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

  private async permissionIds(
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
}
