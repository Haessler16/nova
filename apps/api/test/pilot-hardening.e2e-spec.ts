import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { propertyCalendarDate as calendarDate } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

const GUEST_ANA = '00000000-0000-4000-8000-000000000061';
const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

describe('Pilot hardening (E2E)', () => {
  let app: INestApplication;
  let folioId: string;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores property-scoped pilot feedback and enforces permissions', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/pilot/feedback')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        category: 'UX',
        message: 'Synthetic pilot feedback: the room rack reads clearly.',
        rating: 4,
        context: { route: '/pilot' },
      })
      .expect(201);

    expect(created.body.status).toBe('OPEN');
    expect(created.body.userId).toBe(RECEPTION);

    const denied = await request(app.getHttpServer())
      .get('/api/v1/pilot/feedback')
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');

    const list = await request(app.getHttpServer())
      .get('/api/v1/pilot/feedback')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toContain(created.body.id);

    const reviewed = await request(app.getHttpServer())
      .patch(`/api/v1/pilot/feedback/${created.body.id}/review`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({})
      .expect(200);
    expect(reviewed.body.status).toBe('REVIEWED');
    expect(reviewed.body.reviewedByUserId).toBe(ADMIN);

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/pilot/feedback')
      .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
      .expect(200);
    expect(foreign.body.items).toHaveLength(0);
  });

  it('serializes concurrent folio openings for the same reservation', async () => {
    const reservation = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 2,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: 'pilot-concurrency',
      })
      .expect(201);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/folios')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ reservationId: reservation.body.id, idempotencyKey: `pilot-folio-a-${suffix}` }),
      request(app.getHttpServer())
        .post('/api/v1/folios')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ reservationId: reservation.body.id, idempotencyKey: `pilot-folio-b-${suffix}` }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const opened = responses.find((response) => response.status === 201);
    expect(opened).toBeDefined();
    if (opened === undefined) {
      return;
    }
    folioId = opened.body.id;
    expect(opened.body.status).toBe('OPEN');
  });

  it('rejects the second of two concurrent payments that would overpay', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        description: 'Synthetic concurrency charge',
        amount: '100.00',
        idempotencyKey: `pilot-charge-${suffix}`,
      })
      .expect(201);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/folios/${folioId}/payments`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({ amount: '60.00', method: 'CASH', idempotencyKey: `pilot-pay-a-${suffix}` }),
      request(app.getHttpServer())
        .post(`/api/v1/folios/${folioId}/payments`)
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          amount: '60.00',
          method: 'CREDIT_CARD',
          idempotencyKey: `pilot-pay-b-${suffix}`,
        }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const rejected = responses.find((response) => response.status === 409);
    expect(rejected?.body.code).toBe('payment_exceeds_balance');

    const folio = await request(app.getHttpServer())
      .get(`/api/v1/folios/${folioId}`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(folio.body.totals).toEqual({ charges: '100.00', payments: '60.00', balance: '40.00' });
  });

  it('serializes concurrent cash session openings under the unique open index', async () => {
    const openSessions = await request(app.getHttpServer())
      .get('/api/v1/cash-sessions?status=OPEN')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    for (const session of openSessions.body.items) {
      await request(app.getHttpServer())
        .post(`/api/v1/cash-sessions/${session.id}/close`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({
          closingAmount: session.expectedCashAmount,
          idempotencyKey: `pilot-clean-close-${session.id}`,
        })
        .expect(201);
    }

    const operationalDay = await request(app.getHttpServer())
      .get('/api/v1/properties/current/operational-day')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    const operationalDate = operationalDay.body.operationalDate as string;
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/cash-sessions')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          name: `Caja A ${suffix}`,
          operationalDate,
          openingAmount: '0.00',
          idempotencyKey: `pilot-cash-a-${suffix}`,
        }),
      request(app.getHttpServer())
        .post('/api/v1/cash-sessions')
        .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
        .send({
          name: `Caja B ${suffix}`,
          operationalDate,
          openingAmount: '0.00',
          idempotencyKey: `pilot-cash-b-${suffix}`,
        }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const opened = responses.find((response) => response.status === 201);
    expect(opened).toBeDefined();
    if (opened === undefined) {
      return;
    }

    await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${opened.body.id}/close`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ closingAmount: '0.00', idempotencyKey: `pilot-cash-close-${suffix}` })
      .expect(201);
  });

  it('exposes Prometheus metrics without tenant or guest data', async () => {
    const metrics = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(metrics.text).toContain('nova_http_requests_total');
    expect(metrics.text).not.toMatch(/ana\.souza/i);
  });
});
