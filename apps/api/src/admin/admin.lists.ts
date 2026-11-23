import type { PrismaService } from '../prisma/prisma.service';
import { MEMBERSHIP_SELECT, ROLE_SELECT } from './admin.contracts';

export async function listOrganizationMemberships(
  prisma: PrismaService,
  organizationId: string,
) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    orderBy: [{ status: 'asc' }, { user: { name: 'asc' } }],
    take: 200,
    select: MEMBERSHIP_SELECT,
  });

  const propertyMemberships = await prisma.propertyMembership.findMany({
    where: {
      organizationId,
      userId: { in: memberships.map((membership) => membership.userId) },
    },
    select: {
      id: true,
      userId: true,
      propertyId: true,
      roleId: true,
      status: true,
      property: { select: { id: true, name: true, code: true } },
      role: { select: { id: true, key: true, name: true } },
    },
  });

  const byUser = new Map<string, typeof propertyMemberships>();
  for (const propertyMembership of propertyMemberships) {
    const list = byUser.get(propertyMembership.userId) ?? [];
    list.push(propertyMembership);
    byUser.set(propertyMembership.userId, list);
  }

  return {
    items: memberships.map((membership) => ({
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      roleId: membership.roleId,
      status: membership.status,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      user: membership.user,
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
      propertyMemberships: byUser.get(membership.userId) ?? [],
    })),
  };
}

export async function listPropertyMembershipsOf(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
) {
  const items = await prisma.propertyMembership.findMany({
    where: { organizationId, propertyId },
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

export async function listOrganizationRoles(prisma: PrismaService, organizationId: string) {
  const roles = await prisma.role.findMany({
    where: { organizationId },
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
      permissions: role.permissions.map((rolePermission) => rolePermission.permission.key),
      membershipCount: role._count.memberships,
      propertyMembershipCount: role._count.propertyRoles,
    })),
  };
}
