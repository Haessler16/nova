import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000011';

function headers() {
  return {
    'x-dev-user-id': ADMIN,
    'x-organization-id': ORG_A,
    'x-property-id': PROPERTY_CENTRO,
  };
}

describe('Audit feed timezone (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const action = `test.audit.tz.${suffix}`;

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

  it('filters occurredAt with inclusive property-local days', async () => {
    // 2026-01-15T02:30Z is still 2026-01-14 in America/Sao_Paulo (UTC-3).
    const event = await prisma.auditEvent.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        action,
        entityType: 'TimezoneTest',
        entityId: suffix,
        occurredAt: new Date('2026-01-15T02:30:00.000Z'),
      },
      select: { id: true },
    });

    const localDay = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?action=${action}&fromDate=2026-01-14&toDate=2026-01-14`)
      .set(headers())
      .expect(200);
    expect(localDay.body.items.map((item: { id: string }) => item.id)).toContain(event.id);

    const nextDay = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?action=${action}&fromDate=2026-01-15&toDate=2026-01-15`)
      .set(headers())
      .expect(200);
    expect(nextDay.body.items.map((item: { id: string }) => item.id)).not.toContain(event.id);

    const invalid = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?action=${action}&fromDate=2026-01-15&toDate=2026-01-14`)
      .set(headers())
      .expect(400);
    expect(invalid.body.code).toBe('invalid_date_filter');
  });
});
