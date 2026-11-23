export const MEMBERSHIP_SELECT = {
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

export const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  system: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { memberships: true, propertyRoles: true } },
} as const;
