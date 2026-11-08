import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/http/request-context';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '00000000-0000-4000-8000-000000000002';

const CONTEXT: TenantContext = Object.freeze({
  organizationId: ORGANIZATION_ID,
  propertyId: PROPERTY_ID,
  actor: Object.freeze({
    id: '00000000-0000-4000-8000-000000000011',
    email: 'admin@demo.nova.local',
    name: 'Admin Demo',
  }),
  permissions: new Set(['audit.read']),
  organizationPermissions: new Set(['audit.read']),
  correlationId: 'test-correlation-1',
});

function buildConfig(limit = 8192): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: number) =>
      key === 'AUDIT_METADATA_MAX_BYTES' ? limit : fallback,
    ),
  } as unknown as ConfigService;
}

describe('AuditService', () => {
  it('rejects metadata larger than the configured limit before writing', async () => {
    const create = jest.fn();
    const prisma = { auditEvent: { create } } as unknown as PrismaService;
    const service = new AuditService(prisma, buildConfig(32));

    await expect(
      service.append({
        organizationId: ORGANIZATION_ID,
        action: 'test.action',
        entityType: 'Test',
        entityId: 'entity-1',
        metadata: { payload: 'x'.repeat(100) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });

  it('always scopes audit queries to the resolved organization and property', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { auditEvent: { findMany } } as unknown as PrismaService;
    const service = new AuditService(prisma, buildConfig());

    await service.list(CONTEXT, { limit: 10, action: 'property.created' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORGANIZATION_ID,
          propertyId: PROPERTY_ID,
          action: 'property.created',
        },
        take: 11,
      }),
    );
  });

  it('requires property context for audit queries', async () => {
    const prisma = { auditEvent: { findMany: jest.fn() } } as unknown as PrismaService;
    const service = new AuditService(prisma, buildConfig());

    await expect(service.list({ ...CONTEXT, propertyId: undefined }, {})).rejects.toMatchObject({
      response: { code: 'property_context_required' },
    });
  });

  it('caps page size and reports a cursor when more rows exist', async () => {
    const rows = Array.from({ length: 3 }, (_value, index) => ({
      id: `row-${index}`,
      action: 'test.action',
      entityType: 'Test',
      entityId: `entity-${index}`,
      actorUserId: null,
      occurredAt: new Date(),
      correlationId: null,
      reason: null,
      metadata: null,
    }));
    const prisma = {
      auditEvent: { findMany: jest.fn().mockResolvedValue(rows) },
    } as unknown as PrismaService;
    const service = new AuditService(prisma, buildConfig());

    const page = await service.list(CONTEXT, { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('row-1');
  });
});
