import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const AUDITOR = '00000000-0000-4000-8000-000000000013';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const DISABLED = '00000000-0000-4000-8000-000000000015';

function headers(userId: string, organizationId?: string, propertyId?: string) {
  return {
    'x-dev-user-id': userId,
    ...(organizationId !== undefined ? { 'x-organization-id': organizationId } : {}),
    ...(propertyId !== undefined ? { 'x-property-id': propertyId } : {}),
  };
}

describe('NOVA PMS foundation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('reports liveness without dependencies', async () => {
      const response = await request(app.getHttpServer()).get('/health/live').expect(200);
      expect(response.body.status).toBe('ok');
    });

    it('reports readiness with database and Redis up', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.checks).toEqual({ database: 'up', redis: 'up' });
    });
  });

  describe('authentication', () => {
    it('rejects requests without a development identity', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/me').expect(401);

      expect(response.body.code).toBe('unauthenticated');
    });

    it('rejects disabled users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(headers(DISABLED))
        .expect(401);

      expect(response.body.code).toBe('unauthenticated');
    });

    it('returns the authenticated user with their active memberships', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(headers(ADMIN))
        .expect(200);

      expect(response.body.email).toBe('admin@demo.nova.local');
      expect(response.body.memberships).toHaveLength(1);
      expect(response.body.memberships[0].organization.id).toBe(ORG_A);
      expect(response.body.memberships[0].properties).toHaveLength(2);
    });
  });

  describe('tenant isolation', () => {
    it('lists only organizations where the user has active membership', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set(headers(ADMIN))
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].id).toBe(ORG_A);
    });

    it('lists only properties the user can access inside the selected organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(ADMIN, ORG_A))
        .expect(200);

      const ids = response.body.items.map((property: { id: string }) => property.id);
      expect(ids).toEqual(expect.arrayContaining([PROPERTY_CENTRO, PROPERTY_PRAIA]));
      expect(ids).not.toContain(PROPERTY_BOSQUE);
    });

    it('denies a forged organization header from another tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(RECEPTION, ORG_B))
        .expect(403);

      expect(response.body.code).toBe('organization_access_denied');
    });

    it('denies property access without an active property membership', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(RECEPTION, ORG_A, PROPERTY_PRAIA))
        .expect(403);

      expect(response.body.code).toBe('property_access_denied');
    });

    it('does not resolve a property from a different organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(ADMIN, ORG_A, PROPERTY_BOSQUE))
        .expect(404);

      expect(response.body.code).toBe('property_not_found');
    });

    it('still blocks a user from another organization even with a valid property id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(response.body.code).toBe('organization_access_denied');
    });

    it('requires tenant headers for tenant-scoped routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set(headers(ADMIN))
        .expect(400);

      expect(response.body.code).toBe('invalid_tenant_context');
    });
  });

  describe('authorization and audit', () => {
    it('denies audit reads to roles without audit.read', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(response.body.code).toBe('permission_denied');
    });

    it('allows an auditor to read events only in their property scope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
        .expect(200);

      expect(Array.isArray(response.body.items)).toBe(true);
      for (const event of response.body.items) {
        expect(event.organizationId).toBeUndefined();
      }
    });

    it('blocks an auditor from a property where they have no membership', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .set(headers(AUDITOR, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(response.body.code).toBe('property_access_denied');
    });

    it('denies property creation without property.manage', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ name: 'Blocked Property', code: 'BLOCKED' })
        .expect(403);

      expect(response.body.code).toBe('permission_denied');
    });

    it('rejects tenant identifiers injected through the request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          name: 'Mass Assignment Attempt',
          code: 'MASSASSIGN',
          organizationId: ORG_B,
        })
        .expect(400);

      expect(response.body.code).toBe('validation_failed');
    });

    it('creates a property atomically with an audit event, and the audit log is immutable', async () => {
      const code = `E2E${Date.now().toString(36).toUpperCase()}`;

      const created = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          name: 'E2E Synthetic Property',
          code,
          timezone: 'America/Sao_Paulo',
          currencyCode: 'BRL',
          operationalDayStart: '06:00',
        })
        .expect(201);

      expect(created.body.organizationId).toBe(ORG_A);
      expect(created.body.code).toBe(code);

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'property.created', entityId: created.body.id, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items).toHaveLength(1);
      expect(audit.body.items[0].entityId).toBe(created.body.id);
      expect(audit.body.items[0].actorUserId).toBe(ADMIN);
      expect(audit.body.items[0].metadata).toEqual({ code, name: 'E2E Synthetic Property' });

      const eventId = audit.body.items[0].id;

      let updateFailed = false;
      try {
        await prisma.auditEvent.update({
          where: { id: eventId },
          data: { reason: 'tampering attempt' },
        });
      } catch (error) {
        updateFailed = true;
        expect(String(error)).toContain('append-only');
      }
      expect(updateFailed).toBe(true);

      let deleteFailed = false;
      try {
        await prisma.auditEvent.delete({ where: { id: eventId } });
      } catch (error) {
        deleteFailed = true;
        expect(String(error)).toContain('append-only');
      }
      expect(deleteFailed).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/audit-events/${eventId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(404);
    });
  });
});
