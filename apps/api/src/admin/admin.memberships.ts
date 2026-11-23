import { ConflictException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import type { TenantContext } from '../common/http/request-context';

export interface OrganizationUser {
  id: string;
  status: RecordStatus;
  passwordHash: string | null;
}

export interface ResolvedOrganizationUser {
  user: OrganizationUser;
  /** Set when the membership should trigger a password-reset invitation. */
  invitationEmail: string | null;
}

/**
 * Finds the user by email or creates an invited account. A user that is invited
 * or still has no password also needs the invitation link.
 */
export async function ensureOrganizationUser(
  transaction: Prisma.TransactionClient,
  email: string,
  name: string | undefined,
): Promise<ResolvedOrganizationUser> {
  const existing = await transaction.user.findUnique({
    where: { email },
    select: { id: true, status: true, passwordHash: true },
  });

  if (existing?.status === RecordStatus.DISABLED) {
    throw new ConflictException({
      code: 'user_disabled',
      message: 'The user account is disabled. Reactivate the user before adding a membership.',
    });
  }

  if (existing === null) {
    const localPart = email.split('@')[0] ?? 'User';
    const user = await transaction.user.create({
      data: {
        email,
        name: name?.trim() ?? localPart,
        status: RecordStatus.INVITED,
      },
      select: { id: true, status: true, passwordHash: true },
    });
    return { user, invitationEmail: email };
  }

  const needsInvitation =
    existing.status === RecordStatus.INVITED || existing.passwordHash === null;
  return { user: existing, invitationEmail: needsInvitation ? email : null };
}

/** Upserts the per-property memberships for a newly created organization member. */
export async function applyPropertyAssignments(
  transaction: Prisma.TransactionClient,
  context: TenantContext,
  userId: string,
  assignments: ReadonlyArray<{ propertyId: string; roleId: string }>,
): Promise<void> {
  for (const assignment of assignments) {
    const propertyMembership = await transaction.propertyMembership.findUnique({
      where: {
        propertyId_userId: { propertyId: assignment.propertyId, userId },
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
      continue;
    }

    await transaction.propertyMembership.create({
      data: {
        organizationId: context.organizationId,
        propertyId: assignment.propertyId,
        userId,
        roleId: assignment.roleId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });
  }
}
