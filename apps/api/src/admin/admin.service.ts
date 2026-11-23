import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthRequestMetadata, AuthService, IssuedTokenResponse } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../security-events/security-event.service';
import { ListSecurityEventsQueryDto } from '../security-events/dto/list-security-events.dto';
import { MEMBERSHIP_SELECT } from './admin.contracts';
import { AdminGuards, organizationActorPermissions } from './admin.guards';
import {
  listOrganizationMemberships,
  listOrganizationRoles,
  listPropertyMembershipsOf,
} from './admin.lists';
import { applyPropertyAssignments, ensureOrganizationUser } from './admin.memberships';
import {
  CreateMembershipDto,
  CreatePropertyMembershipDto,
  CreateRoleDto,
  UpdateMembershipDto,
  UpdatePropertyMembershipDto,
  UpdateRoleDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly securityEvents: SecurityEventService,
    private readonly clock: Clock,
    private readonly guards: AdminGuards,
  ) {}

  // -------------------------------------------------------------------------
  // Organization memberships
  // -------------------------------------------------------------------------

  async listMemberships(context: TenantContext) {
    return listOrganizationMemberships(this.prisma, context.organizationId);
  }

  async createMembership(
    context: TenantContext,
    dto: CreateMembershipDto,
    metadata: AuthRequestMetadata,
  ): Promise<{ membership: unknown; invitation?: IssuedTokenResponse }> {
    const email = dto.email.trim().toLowerCase();
    const actorPermissions = organizationActorPermissions(context);

    let roleId: string | null = null;
    if (dto.roleId !== undefined) {
      roleId = (await this.guards.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions))
        .id;
    }

    const propertyAssignments = dto.propertyAssignments ?? [];
    for (const assignment of propertyAssignments) {
      await this.guards.assertProperty(context.organizationId, assignment.propertyId);
      await this.guards.assertRoleSubset(
        context.organizationId,
        assignment.roleId,
        actorPermissions,
      );
    }

    let createdInvitationEmail: string | null = null;
    const membership = await this.prisma.$transaction(async (transaction) => {
      const resolved = await ensureOrganizationUser(transaction, email, dto.name);
      createdInvitationEmail = resolved.invitationEmail;

      const existing = await transaction.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId: resolved.user.id,
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
          userId: resolved.user.id,
          roleId,
          status: RecordStatus.ACTIVE,
        },
        select: MEMBERSHIP_SELECT,
      });

      await applyPropertyAssignments(
        transaction,
        context,
        resolved.user.id,
        propertyAssignments,
      );

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
            userId: resolved.user.id,
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

  async updateMembership(context: TenantContext, membershipId: string, dto: UpdateMembershipDto) {
    const actorPermissions = organizationActorPermissions(context);

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
        await this.guards.assertRoleSubset(context.organizationId, nextRoleId, actorPermissions);
      }

      await this.guards.assertLastAdminGuard(transaction, context.organizationId, {
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
          data: { revokedAt: this.clock.now(), revokedReason: 'membership_deactivated' },
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
    await this.guards.assertProperty(context.organizationId, propertyId);
    return listPropertyMembershipsOf(this.prisma, context.organizationId, propertyId);
  }

  async createPropertyMembership(
    context: TenantContext,
    propertyId: string,
    dto: CreatePropertyMembershipDto,
  ) {
    const actorPermissions = organizationActorPermissions(context);
    await this.guards.assertProperty(context.organizationId, propertyId);
    await this.guards.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions);
    await this.guards.assertOrganizationMember(context.organizationId, dto.userId);

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
    const actorPermissions = organizationActorPermissions(context);
    await this.guards.assertProperty(context.organizationId, propertyId);

    if (dto.roleId !== undefined) {
      await this.guards.assertRoleSubset(context.organizationId, dto.roleId, actorPermissions);
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
    return listOrganizationRoles(this.prisma, context.organizationId);
  }

  async createRole(context: TenantContext, dto: CreateRoleDto) {
    const actorPermissions = organizationActorPermissions(context);
    this.guards.assertPermissionSubset(dto.permissions, actorPermissions);
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
          data: (await this.guards.permissionIds(transaction, dto.permissions)).map(
            (permissionId) => ({
              roleId: created.id,
              permissionId,
            }),
          ),
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
    const actorPermissions = organizationActorPermissions(context);
    if (dto.permissions !== undefined) {
      this.guards.assertPermissionSubset(dto.permissions, actorPermissions);
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
        await this.guards.assertRoleUpdateKeepsAdmin(transaction, context.organizationId, roleId, {
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
            data: (await this.guards.permissionIds(transaction, dto.permissions)).map(
              (permissionId) => ({
                roleId,
                permissionId,
              }),
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
}
