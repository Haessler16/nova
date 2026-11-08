import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const AUDITOR = '00000000-0000-4000-8000-000000000013';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

describe('Property settings and inventory (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  let roomTypeId: string;
  let roomId: string;

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

  describe('room types', () => {
    it('lists only room types in the selected property', async () => {
      const centro = await request(app.getHttpServer())
        .get('/api/v1/inventory/room-types')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const centroCodes = centro.body.items.map((item: { code: string }) => item.code);
      expect(centroCodes).toEqual(expect.arrayContaining(['STD', 'DLX']));

      const praia = await request(app.getHttpServer())
        .get('/api/v1/inventory/room-types')
        .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
        .expect(200);

      const praiaCodes = praia.body.items.map((item: { code: string }) => item.code);
      expect(praiaCodes).toContain('STD');
      expect(praiaCodes).not.toContain('DLX');
    });

    it('denies inventory writes without inventory.manage', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/room-types')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ name: 'Blocked type', code: `X${suffix}` })
        .expect(403);

      expect(response.body.code).toBe('permission_denied');
    });

    it('creates and updates a room type with audit coverage', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/inventory/room-types')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          name: 'E2E Studio',
          code: `E${suffix.slice(-8)}`,
          description: 'Synthetic E2E room type',
          capacityAdults: 2,
          capacityChildren: 0,
          bedType: 'Queen',
        })
        .expect(201);

      roomTypeId = created.body.id;
      expect(created.body.roomCount).toBe(0);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/room-types/${roomTypeId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ capacityAdults: 3, bedType: 'King' })
        .expect(200);

      expect(updated.body.capacityAdults).toBe(3);
      expect(updated.body.bedType).toBe('King');

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'room_type.updated', entityId: roomTypeId })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items).toHaveLength(1);
      expect(audit.body.items[0].actorUserId).toBe(ADMIN);
    });
  });

  describe('rooms and housekeeping', () => {
    it('creates a room in an active room type and rejects duplicate numbers', async () => {
      const roomNumber = `E${suffix.slice(-8)}`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/inventory/rooms')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          number: roomNumber,
          roomTypeId,
          floor: '9',
          building: 'E2E',
          attributes: ['synthetic', 'quiet'],
        })
        .expect(201);

      roomId = created.body.id;
      expect(created.body.housekeepingState).toBe('DIRTY');
      expect(created.body.operationalState).toBe('AVAILABLE');
      expect(created.body.roomType.id).toBe(roomTypeId);

      const duplicate = await request(app.getHttpServer())
        .post('/api/v1/inventory/rooms')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ number: roomNumber, roomTypeId })
        .expect(409);

      expect(duplicate.body.code).toBe('room_number_conflict');
    });

    it('rejects a room type from another property', async () => {
      const praiaType = await request(app.getHttpServer())
        .get('/api/v1/inventory/room-types')
        .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
        .expect(200);
      const praiaTypeId = praiaTypes(praiaType.body.items).id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/rooms')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ number: `P${suffix.slice(-8)}`, roomTypeId: praiaTypeId })
        .expect(404);

      expect(response.body.code).toBe('room_type_not_found');
    });

    it('enforces the housekeeping workflow and records append-only history', async () => {
      const transitions = ['CLEANING', 'CLEAN', 'INSPECTED'];
      for (const state of transitions) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/inventory/rooms/${roomId}/housekeeping-transitions`)
          .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
          .send({ state, reason: `E2E transition to ${state}` })
          .expect(201);
        expect(response.body.housekeepingState).toBe(state);
      }

      const invalid = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/housekeeping-transitions`)
        .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
        .send({ state: 'CLEANING' })
        .expect(422);

      expect(invalid.body.code).toBe('invalid_housekeeping_transition');

      const history = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}/history`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const housekeepingEntries = history.body.items.filter(
        (item: { category: string }) => item.category === 'HOUSEKEEPING',
      );
      expect(housekeepingEntries.length).toBeGreaterThanOrEqual(3);

      const eventId = housekeepingEntries[0].id;
      await expect(
        prisma.roomStatusHistory.update({
          where: { id: eventId },
          data: { reason: 'tampering attempt' },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(prisma.roomStatusHistory.delete({ where: { id: eventId } })).rejects.toThrow(
        /append-only/,
      );
    });

    it('updates room attributes and audits the change', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ floor: '10', attributes: ['synthetic', 'renovated'] })
        .expect(200);

      expect(response.body.floor).toBe('10');
      expect(response.body.attributes).toEqual(['synthetic', 'renovated']);

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'room.updated', entityId: roomId })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items).toHaveLength(1);
    });
  });

  describe('out-of-order and out-of-service blocks', () => {
    it('creates an out-of-order block, prevents overlap and releases it', async () => {
      const startsAt = new Date(Date.now() - 60_000).toISOString();
      const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const created = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          type: 'OUT_OF_ORDER',
          reason: 'Synthetic plumbing repair',
          startsAt,
          endsAt,
        })
        .expect(201);

      expect(created.body.status).toBe('ACTIVE');
      expect(created.body.createdByUserId).toBe(ADMIN);

      const room = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(room.body.operationalState).toBe('OUT_OF_ORDER');

      const overlap = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          type: 'OUT_OF_SERVICE',
          reason: 'Synthetic overlapping block',
          startsAt,
          endsAt,
        })
        .expect(409);

      expect(overlap.body.code).toBe('room_block_overlap');

      const released = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks/${created.body.id}/release`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ reason: 'Synthetic repair completed' })
        .expect(200);

      expect(released.body.status).toBe('RELEASED');

      const available = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(available.body.operationalState).toBe('AVAILABLE');

      const history = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}/history`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const operationalEntries = history.body.items.filter(
        (item: { category: string }) => item.category === 'OPERATIONAL',
      );
      expect(operationalEntries.map((item: { toState: string }) => item.toState)).toEqual(
        expect.arrayContaining(['OUT_OF_ORDER', 'AVAILABLE']),
      );
    });

    it('creates an out-of-service block and rejects inverted intervals', async () => {
      const invalid = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          type: 'OUT_OF_SERVICE',
          reason: 'Synthetic inverted interval',
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .expect(400);

      expect(invalid.body.code).toBe('invalid_room_block_interval');

      const created = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          type: 'OUT_OF_SERVICE',
          reason: 'Synthetic deep cleaning',
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const room = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(room.body.operationalState).toBe('OUT_OF_SERVICE');

      await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/blocks/${created.body.id}/release`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ reason: 'Synthetic cleaning completed' })
        .expect(200);
    });
  });

  describe('property settings and operational day', () => {
    it('updates timezone/operational day and exposes the computed hotel day', async () => {
      const updated = await request(app.getHttpServer())
        .patch('/api/v1/properties/current')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ timezone: 'America/Sao_Paulo', operationalDayStart: '05:30' })
        .expect(200);

      expect(updated.body.operationalDayStart).toBe('05:30');

      const operationalDay = await request(app.getHttpServer())
        .get('/api/v1/properties/current/operational-day')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(operationalDay.body.timezone).toBe('America/Sao_Paulo');
      expect(operationalDay.body.operationalDayStart).toBe('05:30');
      expect(operationalDay.body.operationalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'property.settings_updated', entityId: PROPERTY_CENTRO })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items.length).toBeGreaterThanOrEqual(1);

      await request(app.getHttpServer())
        .patch('/api/v1/properties/current')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ operationalDayStart: '06:00' })
        .expect(200);
    });
  });

  describe('tenant isolation', () => {
    it('denies cross-organization inventory access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(response.body.code).toBe('organization_access_denied');
    });

    it('denies property access without a membership or org-wide role', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(AUDITOR, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(response.body.code).toBe('property_access_denied');
    });
  });
});

function praiaTypes(items: Array<{ id: string; code: string }>): { id: string } {
  const standard = items.find((item) => item.code === 'STD');
  if (standard === undefined) {
    throw new Error('Praia standard room type was not seeded.');
  }
  return standard;
}
