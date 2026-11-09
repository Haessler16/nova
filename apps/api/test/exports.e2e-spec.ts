import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000011';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';
const GUEST_ANA = '00000000-0000-4000-8000-000000000061';
const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';

function headers(userId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': ORG_A,
    'x-property-id': PROPERTY_CENTRO,
  };
}

function calendarDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function csvText(response: { text?: string; body: unknown }): string {
  if (typeof response.text === 'string') {
    return response.text;
  }
  if (Buffer.isBuffer(response.body)) {
    return response.body.toString('utf8');
  }
  return JSON.stringify(response.body);
}

describe('CSV exports (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);

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

  it('exports property-scoped guests as UTF-8 CSV and audits the run', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/exports/guests?search=Ana')
      .set(headers(ADMIN))
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['cache-control']).toBe('no-store');
    const text = csvText(response);
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).toContain('fullName,email,phone');
    expect(text).toContain('Ana');

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'export.guests', propertyId: PROPERTY_CENTRO },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ rowCount: expect.any(Number) });
  });

  it('exports reservations with guest, room type and calendar dates', async () => {
    const reservation = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(ADMIN))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 2,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: `export-${suffix}`,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/exports/reservations?search=${encodeURIComponent(reservation.body.code)}`)
      .set(headers(ADMIN))
      .expect(200);

    const text = csvText(response);
    expect(text).toContain('code,status,checkInDate');
    expect(text).toContain(reservation.body.code);
    expect(text).toContain('guestName');
  });

  it('exports folios with decimal totals and enforces folio.read', async () => {
    const reservation = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(ADMIN))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: `export-folio-${suffix}`,
      })
      .expect(201);

    const folio = await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(ADMIN))
      .send({ reservationId: reservation.body.id, idempotencyKey: `export-folio-${suffix}` })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/exports/folios?search=${encodeURIComponent(folio.body.number)}`)
      .set(headers(ADMIN))
      .expect(200);

    const text = csvText(response);
    expect(text).toContain('number,status,reservationCode');
    expect(text).toContain(folio.body.number);

    const denied = await request(app.getHttpServer())
      .get('/api/v1/exports/folios')
      .set(headers(HOUSEKEEPER))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
  });

  it('rejects invalid audit-style date ranges on reservation exports', async () => {
    const rejected = await request(app.getHttpServer())
      .get(`/api/v1/exports/reservations?fromDate=${tomorrow}&toDate=${today}`)
      .set(headers(ADMIN))
      .expect(400);

    expect(rejected.body.code).toBe('invalid_date_filter');
  });
});
