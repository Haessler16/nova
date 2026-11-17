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
    // Keep the lease test fast and deterministic. The default is 120s.
    process.env.ROOM_ASSIGNMENT_LEASE_TTL_SECONDS = '2';
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

    it('returns occupancy, stay context, summary and composable filters', async () => {
      const occupied = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ occupancy: 'OCCUPIED', limit: 100 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(occupied.body.items.length).toBeGreaterThan(0);
      expect(
        occupied.body.items.every(
          (room: { occupancy: string; currentStay: unknown }) =>
            room.occupancy === 'OCCUPIED' && room.currentStay !== null,
        ),
      ).toBe(true);

      const vacant = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ occupancy: 'VACANT', limit: 100 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(vacant.body.items.length).toBeGreaterThan(0);
      expect(
        vacant.body.items.every(
          (room: { occupancy: string; currentStay: unknown }) =>
            room.occupancy === 'VACANT' && room.currentStay === null,
        ),
      ).toBe(true);

      expect(vacant.body.summary.occupied).toBeGreaterThan(0);
      expect(vacant.body.summary.vacant + vacant.body.summary.occupied).toBe(
        vacant.body.summary.totalRooms,
      );
      expect(Array.isArray(vacant.body.facets.floors)).toBe(true);
      expect(Array.isArray(vacant.body.facets.buildings)).toBe(true);
    });

    it('filters by floor, building and total capacity and exposes the last modifier', async () => {
      const filtered = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ floor: '10', building: 'E2E', minCapacity: 3, limit: 100 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const room = filtered.body.items.find((item: { id: string }) => item.id === roomId);
      expect(room).toBeDefined();
      expect(room.roomType.capacityAdults).toBe(3);
      expect(room.updatedBy).toEqual({ id: ADMIN, name: expect.any(String) });
      expect(room.occupancy).toBe('VACANT');
      expect(room.currentStay).toBeNull();
    });
  });

  describe('room assignment leases', () => {
    it('coordinates two sessions, expires an orphan and releases explicitly', async () => {
      const guest = await request(app.getHttpServer())
        .post('/api/v1/guests')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ fullName: `Lease Guest ${suffix}` })
        .expect(201);
      const checkInDate = new Date().toISOString().slice(0, 10);
      const checkOutDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const reservation = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          guestId: guest.body.id,
          roomTypeId,
          checkInDate,
          checkOutDate,
          adults: 1,
          children: 0,
        })
        .expect(201);

      const acquired = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(201);

      expect(acquired.body.ownerUserId).toBe(RECEPTION);
      expect(acquired.body.ownerDisplayName).toEqual(expect.any(String));
      expect(acquired.body.roomId).toBe(roomId);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ search: `E${suffix.slice(-8)}`, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      const listedRoom = listed.body.items.find((item: { id: string }) => item.id === roomId);
      expect(listedRoom.lease.ownerUserId).toBe(RECEPTION);

      const conflict = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(409);
      expect(conflict.body.code).toBe('room_lease_held');

      const assignmentConflict = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservation.body.id}/room-assignment`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ roomId })
        .expect(409);
      expect(assignmentConflict.body.code).toBe('room_lease_held');

      const renewed = await request(app.getHttpServer())
        .post(
          `/api/v1/inventory/rooms/${roomId}/assignment-leases/${acquired.body.leaseId}/renew`,
        )
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(new Date(renewed.body.expiresAt).getTime()).toBeGreaterThan(
        new Date(acquired.body.expiresAt).getTime(),
      );

      const denied = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(403);
      expect(denied.body.code).toBe('permission_denied');

      await new Promise((resolve) => setTimeout(resolve, 2200));

      const expiredList = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ search: `E${suffix.slice(-8)}`, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      const expiredRoom = expiredList.body.items.find((item: { id: string }) => item.id === roomId);
      expect(expiredRoom.lease).toBeNull();

      await request(app.getHttpServer())
        .post(
          `/api/v1/inventory/rooms/${roomId}/assignment-leases/${acquired.body.leaseId}/renew`,
        )
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(404);

      const reacquired = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .delete(
          `/api/v1/inventory/rooms/${roomId}/assignment-leases/${reacquired.body.leaseId}`,
        )
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(204);

      const releasedList = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ search: `E${suffix.slice(-8)}`, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      const releasedRoom = releasedList.body.items.find((item: { id: string }) => item.id === roomId);
      expect(releasedRoom.lease).toBeNull();

      await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservation.body.id}/room-assignment`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ roomId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservation.body.id}/cancel`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ reason: 'E2E lease cleanup' })
        .expect(201);
    });

    it('rejects a lease for a room from another property', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
        .send({})
        .expect(404);
      expect(response.body.code).toBe('room_not_found');
    });
  });

  describe('forced lease release and lease transfer', () => {
    let destinationRoomId: string;

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/inventory/rooms')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          number: `T${suffix.slice(-8)}`,
          roomTypeId,
          floor: '11',
          building: 'E2E',
        })
        .expect(201);
      destinationRoomId = created.body.id;
    });

    it('releases another session lease and records the reason in the audit trail', async () => {
      const acquired = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(201);

      const forced = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/lease-release`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ leaseId: acquired.body.leaseId, reason: 'Reception session closed' })
        .expect(200);

      expect(forced.body.released).toBe(true);
      expect(forced.body.previousOwnerDisplayName).toEqual(expect.any(String));

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'room_lease_released_forced', entityId: roomId })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items).toHaveLength(1);
      expect(audit.body.items[0].actorUserId).toBe(ADMIN);
      expect(audit.body.items[0].reason).toBe('Reception session closed');
      expect(audit.body.items[0].metadata.previousOwnerUserId).toBe(RECEPTION);

      const list = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ search: `E${suffix.slice(-8)}`, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(list.body.items.find((item: { id: string }) => item.id === roomId).lease).toBeNull();

      const repeated = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/lease-release`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ leaseId: acquired.body.leaseId })
        .expect(200);
      expect(repeated.body.released).toBe(false);
    });

    it('denies a forced release without front office management', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/lease-release`)
        .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
        .send({ leaseId: '00000000-0000-4000-8000-00000000beef' })
        .expect(403);

      expect(response.body.code).toBe('permission_denied');
    });

    it('transfers the selection to another room and keeps it on a conflict', async () => {
      const acquired = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({})
        .expect(201);

      const transferred = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases/transfer`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ toRoomId: destinationRoomId, reason: 'Guest prefers a quiet room' })
        .expect(200);

      expect(transferred.body.from.leaseId).toBe(acquired.body.leaseId);
      expect(transferred.body.to.roomId).toBe(destinationRoomId);
      expect(transferred.body.to.ownerUserId).toBe(RECEPTION);

      const conflict = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${roomId}/assignment-leases/transfer`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ toRoomId: destinationRoomId })
        .expect(409);
      expect(conflict.body.code).toBe('room_lease_held');

      const list = await request(app.getHttpServer())
        .get('/api/v1/inventory/rooms')
        .query({ search: `T${suffix.slice(-8)}`, limit: 10 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(
        list.body.items.find((item: { id: string }) => item.id === destinationRoomId).lease
          .ownerUserId,
      ).toBe(RECEPTION);

      await request(app.getHttpServer())
        .delete(
          `/api/v1/inventory/rooms/${destinationRoomId}/assignment-leases/${transferred.body.to.leaseId}`,
        )
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(204);
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
