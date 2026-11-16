import type { INestApplication } from '@nestjs/common';
import { HousekeepingState, ReservationStatus, StayStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { propertyCalendarDate } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const AUDITOR = '00000000-0000-4000-8000-000000000013';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

const ROOM_DLX_201 = '00000000-0000-4000-8000-000000000054';

const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';
const ROOM_TYPE_DLX = '00000000-0000-4000-8000-000000000042';

const GUEST_ANA = '00000000-0000-4000-8000-000000000061';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

function calendarDate(offsetDays: number): string {
  return propertyCalendarDate(offsetDays);
}

function instant(date: string): string {
  return `${date}T00:00:00.000Z`;
}

describe('Front Office (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);
  const dayAfter = calendarDate(2);
  const past = calendarDate(-2);

  let reservationId: string;
  let stayId: string;
  let incidentId: string;
  let roomAId: string;
  let roomBId: string;
  let dirtyRoomId: string;
  let blockedRoomId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // The seed intentionally fills the demo rooms with in-house stays. Dedicated
    // rooms keep this suite deterministic without mutating demo data.
    const [roomA, roomB, dirtyRoom, blockedRoom] = await Promise.all([
      prisma.room.create({
        data: {
          organizationId: ORG_A,
          propertyId: PROPERTY_CENTRO,
          roomTypeId: ROOM_TYPE_STD,
          number: `E2E-${suffix.slice(-4)}-A`,
          floor: '9',
          building: 'E2E',
          housekeepingState: HousekeepingState.CLEAN,
        },
        select: { id: true },
      }),
      prisma.room.create({
        data: {
          organizationId: ORG_A,
          propertyId: PROPERTY_CENTRO,
          roomTypeId: ROOM_TYPE_STD,
          number: `E2E-${suffix.slice(-4)}-B`,
          floor: '9',
          building: 'E2E',
          housekeepingState: HousekeepingState.CLEAN,
        },
        select: { id: true },
      }),
      prisma.room.create({
        data: {
          organizationId: ORG_A,
          propertyId: PROPERTY_CENTRO,
          roomTypeId: ROOM_TYPE_STD,
          number: `E2E-${suffix.slice(-4)}-C`,
          floor: '9',
          building: 'E2E',
          housekeepingState: HousekeepingState.DIRTY,
        },
        select: { id: true },
      }),
      prisma.room.create({
        data: {
          organizationId: ORG_A,
          propertyId: PROPERTY_CENTRO,
          roomTypeId: ROOM_TYPE_STD,
          number: `E2E-${suffix.slice(-4)}-D`,
          floor: '9',
          building: 'E2E',
          housekeepingState: HousekeepingState.CLEAN,
        },
        select: { id: true },
      }),
    ]);
    roomAId = roomA.id;
    roomBId = roomB.id;
    dirtyRoomId = dirtyRoom.id;
    blockedRoomId = blockedRoom.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an arrival and exposes the room rack', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 2,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        roomId: roomAId,
        source: 'front-office-e2e',
      })
      .expect(201);

    reservationId = created.body.id;

    const overview = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(overview.body.operationalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(overview.body.arrivals.map((item: { id: string }) => item.id)).toContain(reservationId);
    const rackRoomA = overview.body.roomRack.find((room: { id: string }) => room.id === roomAId);
    expect(rackRoomA.occupancy).toBe('VACANT');
    expect(rackRoomA.nextArrival.reservationId).toBe(reservationId);
  });

  it('exposes check-in readiness with per-room eligibility reasons', async () => {
    const readinessOut = calendarDate(4);
    const created = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: dayAfter,
        checkOutDate: readinessOut,
        adults: 2,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: 'front-office-readiness',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/rooms/${blockedRoomId}/blocks`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        type: 'OUT_OF_ORDER',
        reason: 'Synthetic readiness block',
        startsAt: instant(today),
        endsAt: instant(readinessOut),
      })
      .expect(201);

    const readiness = await request(app.getHttpServer())
      .get(`/api/v1/front-office/reservations/${created.body.id}/check-in-readiness`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(readiness.body.reservation.id).toBe(created.body.id);
    expect(readiness.body.currentRoomId).toBeNull();
    expect(readiness.body.currentRoomEligible).toBeNull();
    expect(readiness.body.housekeepingPolicy.blockedStates).toEqual(['DIRTY', 'CLEANING']);
    expect(readiness.body.housekeepingPolicy.inspectionPendingBlocksCheckIn).toBe(false);

    const byId = new Map(
      (readiness.body.rooms as Array<{ id: string; eligible: boolean; reasons: string[] }>).map(
        (room) => [room.id, room],
      ),
    );
    expect(byId.get(roomAId)?.eligible).toBe(true);
    expect(byId.get(roomAId)?.reasons).toEqual([]);
    expect(byId.get(dirtyRoomId)?.eligible).toBe(false);
    expect(byId.get(dirtyRoomId)?.reasons).toContain('HOUSEKEEPING_NOT_READY');
    expect(byId.get(blockedRoomId)?.eligible).toBe(false);
    expect(byId.get(blockedRoomId)?.reasons).toEqual(
      expect.arrayContaining(['ROOM_BLOCKED', 'ROOM_OUT_OF_SERVICE']),
    );
  });

  it('rejects check-in into a room that is not clean', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        roomId: dirtyRoomId,
        source: 'front-office-dirty-room',
      })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${created.body.id}/check-in`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(409);

    expect(rejected.body.code).toBe('room_housekeeping_not_ready');
    expect(rejected.body.details.housekeepingState).toBe('DIRTY');

    const stay = await prisma.stay.findUnique({ where: { reservationId: created.body.id } });
    expect(stay).toBeNull();

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(reservation.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('keeps check-in readiness tenant-scoped and reports missing reservations', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/front-office/reservations/${reservationId}/check-in-readiness`)
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/front-office/reservations/${reservationId}/check-in-readiness`)
      .set(headers(AUDITOR, ORG_A, PROPERTY_CENTRO))
      .expect(403);

    const missing = await request(app.getHttpServer())
      .get('/api/v1/front-office/reservations/00000000-0000-4000-8000-0000000000ff/check-in-readiness')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(404);
    expect(missing.body.code).toBe('reservation_not_found');
  });

  it('allows front-office read to housekeeping but denies check-in without manage', async () => {
    const overview = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(overview.body.operationalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservationId}/check-in`)
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(403);

    expect(denied.body.code).toBe('permission_denied');
  });

  it('checks in idempotently and marks the reservation and room as occupied', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservationId}/check-in`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);

    stayId = first.body.stay.id;
    expect(first.body.stay.status).toBe('IN_HOUSE');
    expect(first.body.reservation.status).toBe('CHECKED_IN');
    expect(first.body.stay.room.id).toBe(roomAId);

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservationId}/check-in`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);

    expect(replay.body.stay.id).toBe(stayId);

    const count = await prisma.stay.count({ where: { reservationId } });
    expect(count).toBe(1);

    const overview = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(overview.body.inHouse.map((item: { id: string }) => item.id)).toContain(stayId);
    const rackRoomA = overview.body.roomRack.find((room: { id: string }) => room.id === roomAId);
    expect(rackRoomA.occupancy).toBe('OCCUPIED');
    expect(rackRoomA.currentStay.id).toBe(stayId);
  });

  it('moves an in-house stay to another room and rejects room type mismatches', async () => {
    const moved = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/room-move`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ roomId: roomBId, reason: 'Synthetic E2E room move' })
      .expect(201);

    expect(moved.body.room.id).toBe(roomBId);
    expect(moved.body.moveCount).toBe(1);

    const reservation = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(reservation.body.room.id).toBe(roomBId);

    const mismatch = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/room-move`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ roomId: ROOM_DLX_201 })
      .expect(409);

    expect(mismatch.body.code).toBe('room_type_mismatch');
  });

  it('records and resolves an incident linked to the stay', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/front-office/incidents')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        type: 'MAINTENANCE',
        severity: 'HIGH',
        title: `Synthetic incident ${suffix}`,
        description: 'Synthetic E2E incident. No real guest data.',
        stayId,
      })
      .expect(201);

    incidentId = created.body.id;
    expect(created.body.room.id).toBe(roomBId);
    expect(created.body.reservation.id).toBe(reservationId);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/front-office/incidents')
      .query({ status: 'OPEN' })
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(incidentId);

    const resolved = await request(app.getHttpServer())
      .post(`/api/v1/front-office/incidents/${incidentId}/resolve`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ resolution: 'Synthetic E2E resolution.' })
      .expect(201);

    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.resolvedAt).toEqual(expect.any(String));

    const history = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}/history`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    const actions = history.body.items.map((item: { action: string }) => item.action);
    expect(actions).toEqual(
      expect.arrayContaining(['reservation.checked_in', 'reservation.room_moved']),
    );
  });

  it('checks out idempotently and frees the room', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ notes: 'Synthetic E2E checkout.' })
      .expect(201);

    expect(first.body.status).toBe('CHECKED_OUT');
    expect(first.body.checkedOutAt).toEqual(expect.any(String));

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);

    expect(replay.body.id).toBe(stayId);

    const reservation = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(reservation.body.status).toBe('CHECKED_OUT');

    const overview = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(overview.body.inHouse.map((item: { id: string }) => item.id)).not.toContain(stayId);
    const rackRoomB = overview.body.roomRack.find((room: { id: string }) => room.id === roomBId);
    expect(rackRoomB.occupancy).toBe('VACANT');
  });

  it('returns arrivals, in-house stays and check-outs for a past operational day', async () => {
    const historyDate = calendarDate(-5);
    const historyCheckOut = calendarDate(-4);
    const historicalReservation = await prisma.reservation.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        code: `HIS${suffix.slice(-10)}`,
        status: ReservationStatus.CHECKED_OUT,
        checkInDate: new Date(instant(historyDate)),
        checkOutDate: new Date(instant(historyCheckOut)),
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        roomId: roomAId,
      },
      select: { id: true },
    });
    const historicalStay = await prisma.stay.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        reservationId: historicalReservation.id,
        guestId: GUEST_ANA,
        roomId: roomAId,
        status: StayStatus.CHECKED_OUT,
        checkedInAt: new Date(`${historyDate}T15:00:00.000Z`),
        checkedOutAt: new Date(`${historyDate}T18:00:00.000Z`),
      },
      select: { id: true },
    });

    const overview = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .query({ date: historyDate })
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(overview.body.selectedDate).toBe(historyDate);
    expect(overview.body.isHistorical).toBe(true);
    expect(overview.body.operationalDate).not.toBe(historyDate);
    expect(overview.body.arrivals.map((item: { id: string }) => item.id)).toContain(
      historicalReservation.id,
    );
    expect(overview.body.inHouse.map((item: { id: string }) => item.id)).toContain(
      historicalStay.id,
    );
    expect(overview.body.departures.map((item: { id: string }) => item.id)).toContain(
      historicalStay.id,
    );
  });

  it('records a no-show only after the arrival date', async () => {
    const previous = await prisma.reservation.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        code: `NS${suffix.slice(-10)}`,
        checkInDate: new Date(instant(past)),
        checkOutDate: new Date(instant(calendarDate(-1))),
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
      },
    });

    const marked = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${previous.id}/no-show`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ reason: 'Synthetic E2E no-show' })
      .expect(201);

    expect(marked.body.status).toBe('NO_SHOW');

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${previous.id}/no-show`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);

    expect(replay.body.id).toBe(previous.id);

    const future = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: dayAfter,
        checkOutDate: calendarDate(3),
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
      })
      .expect(201);

    const tooEarly = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${future.body.id}/no-show`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(409);

    expect(tooEarly.body.code).toBe('no_show_too_early');
  });

  it('enforces tenant and property scope on front-office data', async () => {
    const wrongOrganization = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(wrongOrganization.body.code).toBe('organization_access_denied');

    const wrongProperty = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(AUDITOR, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(wrongProperty.body.code).toBe('property_access_denied');

    const praia = await request(app.getHttpServer())
      .get('/api/v1/front-office/overview')
      .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
      .expect(200);

    expect(praia.body.inHouse).toEqual([]);
  });

  it('prevents checking in an unassigned or past reservation', async () => {
    const unassigned = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_DLX,
      })
      .expect(201);

    const missingRoom = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${unassigned.body.id}/check-in`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(409);

    expect(missingRoom.body.code).toBe('reservation_room_required');
  });
});
