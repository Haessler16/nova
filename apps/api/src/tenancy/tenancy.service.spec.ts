import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { AuthenticatedActor } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from './tenancy.service';

const ACTOR: AuthenticatedActor = {
  id: '00000000-0000-4000-8000-000000000011',
  email: 'admin@demo.nova.local',
  name: 'Admin Demo',
};

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '00000000-0000-4000-8000-000000000002';
const CORRELATION_ID = 'test-correlation-1';

function buildPrisma(): {
  prisma: PrismaService;
  membershipFindFirst: jest.Mock;
  propertyFindFirst: jest.Mock;
  propertyMembershipFindFirst: jest.Mock;
} {
  const membershipFindFirst = jest.fn();
  const propertyFindFirst = jest.fn();
  const propertyMembershipFindFirst = jest.fn();

  const prisma = {
    membership: { findFirst: membershipFindFirst },
    property: { findFirst: propertyFindFirst },
    propertyMembership: { findFirst: propertyMembershipFindFirst },
  } as unknown as PrismaService;

  return { prisma, membershipFindFirst, propertyFindFirst, propertyMembershipFindFirst };
}

describe('TenancyService.resolveContext', () => {
  it('builds an immutable server-side context for an authorized property member', async () => {
    const { prisma, membershipFindFirst, propertyFindFirst, propertyMembershipFindFirst } =
      buildPrisma();
    membershipFindFirst.mockResolvedValue({ id: 'membership-1' });
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID });
    propertyMembershipFindFirst.mockResolvedValue({
      role: {
        permissions: [
          { permission: { key: 'property.read' } },
          { permission: { key: 'audit.read' } },
        ],
      },
    });

    const service = new TenancyService(prisma);
    const context = await service.resolveContext(
      ACTOR,
      ORGANIZATION_ID,
      PROPERTY_ID,
      CORRELATION_ID,
    );

    expect(context.organizationId).toBe(ORGANIZATION_ID);
    expect(context.propertyId).toBe(PROPERTY_ID);
    expect(context.actor).toBe(ACTOR);
    expect([...context.permissions].sort()).toEqual(['audit.read', 'property.read']);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('denies access when the user has no active organization membership', async () => {
    const { prisma, membershipFindFirst } = buildPrisma();
    membershipFindFirst.mockResolvedValue(null);

    const service = new TenancyService(prisma);

    const rejection = service.resolveContext(ACTOR, ORGANIZATION_ID, undefined, CORRELATION_ID);

    await expect(rejection).rejects.toBeInstanceOf(ForbiddenException);
    await expect(rejection).rejects.toMatchObject({
      response: { code: 'organization_access_denied' },
    });
  });

  it('hides properties that do not belong to the selected organization', async () => {
    const { prisma, membershipFindFirst, propertyFindFirst } = buildPrisma();
    membershipFindFirst.mockResolvedValue({ id: 'membership-1' });
    propertyFindFirst.mockResolvedValue(null);

    const service = new TenancyService(prisma);

    const rejection = service.resolveContext(ACTOR, ORGANIZATION_ID, PROPERTY_ID, CORRELATION_ID);

    await expect(rejection).rejects.toBeInstanceOf(NotFoundException);
    await expect(rejection).rejects.toMatchObject({
      response: { code: 'property_not_found' },
    });
  });

  it('denies property access without an active property membership', async () => {
    const { prisma, membershipFindFirst, propertyFindFirst, propertyMembershipFindFirst } =
      buildPrisma();
    membershipFindFirst.mockResolvedValue({ id: 'membership-1' });
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID });
    propertyMembershipFindFirst.mockResolvedValue(null);

    const service = new TenancyService(prisma);

    const rejection = service.resolveContext(ACTOR, ORGANIZATION_ID, PROPERTY_ID, CORRELATION_ID);

    await expect(rejection).rejects.toBeInstanceOf(ForbiddenException);
    await expect(rejection).rejects.toMatchObject({
      response: { code: 'property_access_denied' },
    });
  });

  it('keeps organization-only context free of property permissions', async () => {
    const { prisma, membershipFindFirst } = buildPrisma();
    membershipFindFirst.mockResolvedValue({ id: 'membership-1' });

    const service = new TenancyService(prisma);
    const context = await service.resolveContext(ACTOR, ORGANIZATION_ID, undefined, CORRELATION_ID);

    expect(context.propertyId).toBeUndefined();
    expect(context.permissions.size).toBe(0);
    expect(membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: RecordStatus.ACTIVE }),
      }),
    );
  });
});
