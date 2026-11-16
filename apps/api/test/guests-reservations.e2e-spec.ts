import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { propertyCalendarDate as calendarDate } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const AUDITOR = '00000000-0000-4000-8000-000000000013';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

const ROOM_STD_101 = '00000000-0000-4000-8000-000000000051';
const ROOM_STD_102 = '00000000-0000-4000-8000-000000000052';
const ROOM_STD_103 = '00000000-0000-4000-8000-000000000053';
const ROOM_DLX_201 = '00000000-0000-4000-8000-000000000054';
const ROOM_DLX_202 = '00000000-0000-4000-8000-000000000059';

const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';
const ROOM_TYPE_DLX = '00000000-0000-4000-8000-000000000042';

const GUEST_ANA = '00000000-0000-4000-8000-000000000061';
const GUEST_CARLA = '00000000-0000-4000-8000-000000000063';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

function instant(date: string): string {
  return `${date}T00:00:00.000Z`;
}

describe('Guests and reservations (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const day1 = calendarDate(180);
  const day2 = calendarDate(181);
  const day3 = calendarDate(182);
  const day4 = calendarDate(183);
  const day5 = calendarDate(184);
  const day6 = calendarDate(185);
  const day8 = calendarDate(187);
  const day10 = calendarDate(189);

  let guestId: string;
  let firstReservationId: string;
  let firstRoomNumber: string;
  let backToBackReservationId: string;

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

  describe('guests', () => {
    it('creates, searches and updates a guest without leaking PII into audit', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/guests')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          fullName: `Synthetic Guest ${suffix}`,
          email: `guest-${suffix.toLowerCase()}@demo.nova.local`,
          phone: '+55 11 90000-1234',
          documentType: 'PASSPORT',
          documentNumber: `E2E-${suffix}`,
          notes: 'Synthetic E2E guest.',
        })
        .expect(201);

      guestId = created.body.id;
      expect(created.body.status).toBe('ACTIVE');
      expect(created.body.email).toBe(`guest-${suffix.toLowerCase()}@demo.nova.local`);

      const search = await request(app.getHttpServer())
        .get('/api/v1/guests')
        .query({ search: suffix.toLowerCase() })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(search.body.items.map((item: { id: string }) => item.id)).toContain(guestId);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/guests/${guestId}`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ phone: '+55 11 90000-5678' })
        .expect(200);

      expect(updated.body.phone).toBe('+55 11 90000-5678');

      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({ action: 'guest.created', entityId: guestId })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(audit.body.items).toHaveLength(1);
      expect(JSON.stringify(audit.body.items[0].metadata)).not.toContain('guest-');
    });

    it('rejects a document type without a number and cross-property guest access', async () => {
      const invalid = await request(app.getHttpServer())
        .post('/api/v1/guests')
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ fullName: 'Invalid Document Guest', documentType: 'PASSPORT' })
        .expect(400);

      expect(invalid.body.code).toBe('invalid_guest_document');

      const crossProperty = await request(app.getHttpServer())
        .get(`/api/v1/guests/${GUEST_CARLA}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(404);

      expect(crossProperty.body.code).toBe('guest_not_found');
    });
  });

  describe('reservations', () => {
    it('creates a reservation with a room assignment and removes it from availability', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day1,
          checkOutDate: day3,
          adults: 2,
          children: 0,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_STD,
          roomId: ROOM_STD_101,
          source: 'e2e',
        })
        .expect(201);

      firstReservationId = created.body.id;
      firstRoomNumber = created.body.room.number;
      expect(created.body.status).toBe('CONFIRMED');
      expect(created.body.checkInDate).toBe(day1);
      expect(created.body.checkOutDate).toBe(day3);
      expect(created.body.nights).toBe(2);
      expect(created.body.room.id).toBe(ROOM_STD_101);
      expect(created.body.guest.id).toBe(GUEST_ANA);

      const availability = await request(app.getHttpServer())
        .get('/api/v1/reservations/availability')
        .query({ checkInDate: day1, checkOutDate: day3 })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const roomIds = availability.body.items.map((item: { roomId: string }) => item.roomId);
      expect(roomIds).not.toContain(ROOM_STD_101);
      expect(roomIds).toContain(ROOM_STD_102);

      const list = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ fromDate: day1, toDate: day3 })
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(firstReservationId);
    });

    it('searches by accented guest name, room number, code and paginated window', async () => {
      const accentedGuest = await request(app.getHttpServer())
        .post('/api/v1/guests')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ fullName: `José Acción ${suffix}` })
        .expect(201);

      const unassigned = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day4,
          checkOutDate: day6,
          adults: 1,
          guestId: accentedGuest.body.id,
          roomTypeId: ROOM_TYPE_STD,
        })
        .expect(201);

      const withoutAccent = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ search: 'jose accion' })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(
        withoutAccent.body.items.map((item: { id: string }) => item.id),
      ).toContain(unassigned.body.id);

      const withAccent = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ search: 'JOSÉ' })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(withAccent.body.items.map((item: { id: string }) => item.id)).toContain(
        unassigned.body.id,
      );

      const byRoomNumber = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ roomNumber: firstRoomNumber })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(byRoomNumber.body.items.map((item: { id: string }) => item.id)).toContain(
        firstReservationId,
      );

      const byCode = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ search: unassigned.body.code.toLowerCase() })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(byCode.body.items.map((item: { id: string }) => item.id)).toContain(
        unassigned.body.id,
      );

      const missing = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ search: `no-match-${suffix.toLowerCase()}` })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(missing.body.items).toEqual([]);

      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .query({ fromDate: day1, toDate: day6, limit: 1 })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);
      expect(firstPage.body.items).toHaveLength(1);
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));
    });

    it('allows back-to-back stays but rejects an overlapping assignment', async () => {
      const backToBack = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day3,
          checkOutDate: day5,
          adults: 1,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_STD,
          roomId: ROOM_STD_101,
        })
        .expect(201);

      backToBackReservationId = backToBack.body.id;

      const overlap = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day2,
          checkOutDate: day4,
          adults: 1,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_STD,
          roomId: ROOM_STD_101,
        })
        .expect(409);

      expect(overlap.body.code).toBe('room_not_available');
    });

    it('prevents two concurrent confirmations of the same room', async () => {
      const attempt = (code: string) =>
        request(app.getHttpServer())
          .post('/api/v1/reservations')
          .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
          .send({
            checkInDate: day1,
            checkOutDate: day3,
            adults: 1,
            guestId: GUEST_ANA,
            roomTypeId: ROOM_TYPE_STD,
            roomId: ROOM_STD_102,
            code,
          });

      const [first, second] = await Promise.all([
        attempt(`E2EA${suffix.slice(-6)}`),
        attempt(`E2EB${suffix.slice(-6)}`),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      const rejected = first.status === 409 ? first : second;
      expect(rejected.body.code).toBe('room_not_available');

      const active = await prisma.reservation.count({
        where: {
          propertyId: PROPERTY_CENTRO,
          roomId: ROOM_STD_102,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          checkInDate: { lt: new Date(instant(day3)) },
          checkOutDate: { gt: new Date(instant(day1)) },
        },
      });
      expect(active).toBe(1);
    });

    it('keeps the database exclusion constraint as the final overlap authority', async () => {
      await expect(
        prisma.reservation.create({
          data: {
            organizationId: ORG_A,
            propertyId: PROPERTY_CENTRO,
            code: `DB${suffix.slice(-8)}`,
            checkInDate: new Date(instant(day1)),
            checkOutDate: new Date(instant(day2)),
            adults: 1,
            guestId: GUEST_ANA,
            roomTypeId: ROOM_TYPE_STD,
            roomId: ROOM_STD_101,
            createdByUserId: ADMIN,
          },
        }),
      ).rejects.toThrow(/exclusion|overlap|23P01|Reservation_room_date_no_overlap/i);
    });

    it('rejects a stay overlapping an active room block', async () => {
      const block = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rooms/${ROOM_DLX_201}/blocks`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          type: 'OUT_OF_ORDER',
          reason: 'Synthetic E2E maintenance',
          startsAt: instant(day1),
          endsAt: instant(day2),
        })
        .expect(201);

      expect(block.body.status).toBe('ACTIVE');

      const conflict = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day1,
          checkOutDate: day2,
          adults: 1,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_DLX,
          roomId: ROOM_DLX_201,
        })
        .expect(409);

      expect(conflict.body.code).toBe('room_block_overlap');

      const availability = await request(app.getHttpServer())
        .get('/api/v1/reservations/availability')
        .query({ checkInDate: day1, checkOutDate: day2, roomTypeId: ROOM_TYPE_DLX })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const availableRoomIds = availability.body.items.map(
        (item: { roomId: string }) => item.roomId,
      );
      expect(availableRoomIds).not.toContain(ROOM_DLX_201);
      expect(availableRoomIds).toContain(ROOM_DLX_202);
    });

    it('is idempotent for repeated creation keys', async () => {
      const payload = {
        checkInDate: day6,
        checkOutDate: day8,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        roomId: ROOM_STD_103,
        idempotencyKey: `e2e-idem-${suffix.toLowerCase()}`,
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send(payload)
        .expect(201);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send(payload)
        .expect(201);

      expect(replay.body.id).toBe(first.body.id);

      const count = await prisma.reservation.count({
        where: { propertyId: PROPERTY_CENTRO, idempotencyKey: payload.idempotencyKey },
      });
      expect(count).toBe(1);

      const conflict = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ ...payload, checkOutDate: calendarDate(188) })
        .expect(409);

      expect(conflict.body.code).toBe('idempotency_key_reuse');
    });

    it('cancels a reservation, frees the room and preserves append-only history', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day8,
          checkOutDate: day10,
          adults: 1,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_STD,
          roomId: ROOM_STD_103,
        })
        .expect(201);

      const cancelled = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${created.body.id}/cancel`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ reason: 'Synthetic E2E cancellation' })
        .expect(201);

      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.cancellationReason).toBe('Synthetic E2E cancellation');
      expect(cancelled.body.cancelledAt).toEqual(expect.any(String));

      const history = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${created.body.id}/history`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      const actions = history.body.items.map((item: { action: string }) => item.action);
      expect(actions).toEqual(
        expect.arrayContaining(['reservation.created', 'reservation.cancelled']),
      );

      const historyEntryId = history.body.items[0].id;
      await expect(
        prisma.reservationHistory.update({
          where: { id: historyEntryId },
          data: { reason: 'tampering attempt' },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.reservationHistory.delete({ where: { id: historyEntryId } }),
      ).rejects.toThrow(/append-only/);

      const availability = await request(app.getHttpServer())
        .get('/api/v1/reservations/availability')
        .query({ checkInDate: day8, checkOutDate: day10 })
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .expect(200);

      expect(availability.body.items.map((item: { roomId: string }) => item.roomId)).toContain(
        ROOM_STD_103,
      );
    });

    it('updates stay details while revalidating availability and capacity', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/reservations/${backToBackReservationId}`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ checkInDate: day3, checkOutDate: day6 })
        .expect(200);

      expect(updated.body.checkOutDate).toBe(day6);
      expect(updated.body.nights).toBe(3);

      const overCapacity = await request(app.getHttpServer())
        .patch(`/api/v1/reservations/${backToBackReservationId}`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ adults: 5 })
        .expect(409);

      expect(overCapacity.body.code).toBe('occupancy_exceeds_room_type');

      const overlap = await request(app.getHttpServer())
        .patch(`/api/v1/reservations/${backToBackReservationId}`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ checkInDate: day2, checkOutDate: day4 })
        .expect(409);

      expect(overlap.body.code).toBe('room_not_available');

      const invalidWindow = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day6,
          checkOutDate: day6,
          adults: 1,
          guestId: GUEST_ANA,
          roomTypeId: ROOM_TYPE_STD,
        })
        .expect(400);

      expect(invalidWindow.body.code).toBe('invalid_stay_window');
    });

    it('rejects room assignment across room types and cross-tenant access', async () => {
      const mismatch = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${backToBackReservationId}/room-assignment`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ roomId: ROOM_DLX_201 })
        .expect(409);

      expect(mismatch.body.code).toBe('room_type_mismatch');

      const crossOrganization = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(crossOrganization.body.code).toBe('organization_access_denied');

      const crossProperty = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .set(headers(AUDITOR, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(crossProperty.body.code).toBe('property_access_denied');

      const guestFromAnotherProperty = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          checkInDate: day1,
          checkOutDate: day2,
          adults: 1,
          guestId: GUEST_CARLA,
          roomTypeId: ROOM_TYPE_STD,
        })
        .expect(404);

      expect(guestFromAnotherProperty.body.code).toBe('guest_not_found');

      const denied = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      expect(denied.body.code).toBe('permission_denied');

      const praiaProperty = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
        .expect(200);

      expect(praiaProperty.body.items).toEqual([]);
    });
  });
});
