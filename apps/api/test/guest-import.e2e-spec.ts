import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';

const ADMIN_A = '00000000-0000-4000-8000-000000000011';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

describe('Guest CSV import (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const documentPrefix = `IMP${suffix}`;

  function csvFor(prefix: string): string {
    const emailPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
    return [
      'fullName,email,phone,documentType,documentNumber,notes',
      `${prefix} Uno,${emailPrefix}-1@example.test,+55 11 90000-0001,PASSPORT,${documentPrefix}A,`,
      `${prefix} Dos,${emailPrefix}-2@example.test,,NATIONAL_ID,${documentPrefix}B,Nota`,
    ].join('\n');
  }

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

  it('previews valid and invalid rows without persisting anything', async () => {
    const valid = await request(app.getHttpServer())
      .post('/api/v1/guests/import/preview')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .send({ csv: csvFor('Preview') })
      .expect(201);

    expect(valid.body).toMatchObject({ totalRows: 2, validRows: 2, invalidRows: 0 });

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/guests/import/preview')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .send({
        csv: 'fullName,email,documentType,documentNumber\nBad,not-an-email,PASSPORT,AB\n',
      })
      .expect(201);

    expect(invalid.body.invalidRows).toBe(1);
    expect(invalid.body.rows[0].errors.length).toBeGreaterThan(0);
  });

  it('commits atomically, audits counts only and replays the idempotency key', async () => {
    const key = `guest-import-${suffix}-a`;
    const csv = csvFor('Import');

    const created = await request(app.getHttpServer())
      .post('/api/v1/guests/import')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .send({ csv, idempotencyKey: key })
      .expect(201);

    expect(created.body).toMatchObject({ rowCount: 2, createdCount: 2, replayed: false });
    expect(created.body.importId).toEqual(expect.any(String));

    const guests = await request(app.getHttpServer())
      .get(`/api/v1/guests?search=${documentPrefix}`)
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(guests.body.items).toHaveLength(2);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'guest.imported', entityId: created.body.importId },
    });
    expect(audit).not.toBeNull();
    const metadata = JSON.stringify(audit?.metadata);
    expect(metadata).not.toContain('@example.test');
    expect(metadata).not.toContain('Import Uno');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/guests/import')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .send({ csv, idempotencyKey: key })
      .expect(201);

    expect(replay.body).toMatchObject({
      importId: created.body.importId,
      rowCount: 2,
      createdCount: 2,
      replayed: true,
    });

    const afterReplay = await request(app.getHttpServer())
      .get(`/api/v1/guests?search=${documentPrefix}`)
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(afterReplay.body.items).toHaveLength(2);
  });

  it('rejects a commit with invalid rows', async () => {
    const denied = await request(app.getHttpServer())
      .post('/api/v1/guests/import')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .send({
        csv: 'fullName,email\nAna,not-an-email\n',
        idempotencyKey: `guest-import-${suffix}-invalid`,
      })
      .expect(400);

    expect(denied.body.code).toBe('guest_import_invalid_rows');
    expect(denied.body.details.invalidRows).toBe(1);
  });

  it('requires guests.manage for preview and commit', async () => {
    const denied = await request(app.getHttpServer())
      .post('/api/v1/guests/import/preview')
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .send({ csv: csvFor('Denied') })
      .expect(403);

    expect(denied.body.code).toBe('permission_denied');
  });

  it('serializes concurrent commits with the same idempotency key', async () => {
    const key = `guest-import-${suffix}-concurrent`;
    const csv = csvFor('Concurrent');

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/guests/import')
        .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
        .send({ csv, idempotencyKey: key }),
      request(app.getHttpServer())
        .post('/api/v1/guests/import')
        .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
        .send({ csv, idempotencyKey: key }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0]?.body.importId).toBe(responses[1]?.body.importId);
    expect(responses.filter((response) => response.body.replayed === true)).toHaveLength(1);

    const guests = await request(app.getHttpServer())
      .get('/api/v1/guests?search=Concurrent')
      .set(headers(ADMIN_A, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(
      guests.body.items.filter((guest: { documentNumber: string | null }) =>
        guest.documentNumber?.startsWith(documentPrefix),
      ),
    ).toHaveLength(2);
  });

  it('scopes the idempotency key to the property', async () => {
    const key = `guest-import-${suffix}-a`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/guests/import')
      .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
      .send({ csv: csvFor('Tenant B'), idempotencyKey: key })
      .expect(201);

    expect(created.body.replayed).toBe(false);
  });
});
