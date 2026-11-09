import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const AUDITOR = '00000000-0000-4000-8000-000000000013';
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

function calendarDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe('Folio, cash and night audit (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);

  let reservationId: string;
  let folioId: string;
  let cashSessionId: string;
  let operationalCloseId: string;

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

  it('creates a reservation to attach the folio', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 2,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: 'folio-e2e',
      })
      .expect(201);

    reservationId = created.body.id;
    expect(created.body.status).toBe('CONFIRMED');
  });

  it('opens a folio idempotently and rejects cross-property links', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        reservationId,
        notes: 'Synthetic E2E folio.',
        idempotencyKey: `folio-open-${suffix}`,
      })
      .expect(201);

    folioId = first.body.id;
    expect(first.body.status).toBe('OPEN');
    expect(first.body.currencyCode).toBe('BRL');
    expect(first.body.totals).toEqual({ charges: '0.00', payments: '0.00', balance: '0.00' });

    const replay = await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        reservationId,
        notes: 'Synthetic E2E folio.',
        idempotencyKey: `folio-open-${suffix}`,
      })
      .expect(201);

    expect(replay.body.id).toBe(folioId);
    expect(await prisma.folio.count({ where: { reservationId } })).toBe(1);

    const wrongProperty = await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
      .send({
        reservationId,
        idempotencyKey: `folio-cross-${suffix}`,
      })
      .expect(404);

    expect(wrongProperty.body.code).toBe('reservation_not_found');

    await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        reservationId,
        idempotencyKey: `folio-open-different-${suffix}`,
      })
      .expect(409);
  });

  it('posts charges and records payments without allowing overpayment', async () => {
    const charge1 = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        description: 'Room service (demo)',
        amount: '150.00',
        idempotencyKey: `charge-1-${suffix}`,
      })
      .expect(201);

    expect(charge1.body.totals).toEqual({ charges: '150.00', payments: '0.00', balance: '150.00' });

    const chargeReplay = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        description: 'Room service (demo)',
        amount: '150.00',
        idempotencyKey: `charge-1-${suffix}`,
      })
      .expect(201);

    expect(chargeReplay.body.lines).toHaveLength(1);

    const charge2 = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        description: 'Minibar (demo)',
        amount: '50.00',
        idempotencyKey: `charge-2-${suffix}`,
      })
      .expect(201);

    expect(charge2.body.totals).toEqual({ charges: '200.00', payments: '0.00', balance: '200.00' });

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/payments`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        amount: '100.00',
        method: 'CASH',
        idempotencyKey: `payment-1-${suffix}`,
      })
      .expect(201);

    expect(payment.body.totals).toEqual({
      charges: '200.00',
      payments: '100.00',
      balance: '100.00',
    });
    expect(payment.body.status).toBe('OPEN');

    const overpay = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/payments`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        amount: '120.00',
        method: 'CREDIT_CARD',
        idempotencyKey: `payment-over-${suffix}`,
      })
      .expect(409);

    expect(overpay.body.code).toBe('payment_exceeds_balance');

    const settled = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/payments`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        amount: '100.00',
        method: 'CREDIT_CARD',
        referenceId: 'demo-auth-001',
        idempotencyKey: `payment-2-${suffix}`,
      })
      .expect(201);

    expect(settled.body.totals).toEqual({ charges: '200.00', payments: '200.00', balance: '0.00' });
    expect(settled.body.status).toBe('SETTLED');
    expect(settled.body.payments).toHaveLength(2);
    expect(JSON.stringify(settled.body)).not.toMatch(/cardNumber|cvv|pan/i);
  });

  it('enforces folio permissions and tenant scope', async () => {
    const denied = await request(app.getHttpServer())
      .get(`/api/v1/folios/${folioId}`)
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');

    const auditor = await request(app.getHttpServer())
      .get(`/api/v1/folios/${folioId}`)
      .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
      .expect(404);
    expect(auditor.body.code).toBe('folio_not_found');

    const foreignOrg = await request(app.getHttpServer())
      .get(`/api/v1/folios/${folioId}`)
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(foreignOrg.body.code).toBe('organization_access_denied');
  });

  it('opens, reconciles and closes a cash session', async () => {
    const operationalDay = await request(app.getHttpServer())
      .get('/api/v1/properties/current/operational-day')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    const operationalDate = operationalDay.body.operationalDate as string;

    const opened = await request(app.getHttpServer())
      .post('/api/v1/cash-sessions')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        name: `Caja ${suffix}`,
        operationalDate,
        openingAmount: '500.00',
        idempotencyKey: `cash-open-${suffix}`,
      })
      .expect(201);

    cashSessionId = opened.body.id;
    expect(opened.body.status).toBe('OPEN');
    expect(opened.body.expectedCashAmount).toBe('500.00');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/cash-sessions')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        name: `Caja ${suffix}`,
        operationalDate,
        openingAmount: '500.00',
        idempotencyKey: `cash-open-${suffix}`,
      })
      .expect(201);
    expect(replay.body.id).toBe(cashSessionId);

    const secondOpen = await request(app.getHttpServer())
      .post('/api/v1/cash-sessions')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        name: `Caja duplicada ${suffix}`,
        operationalDate,
        openingAmount: '0.00',
        idempotencyKey: `cash-open-2-${suffix}`,
      })
      .expect(409);
    expect(secondOpen.body.code).toBe('cash_session_already_open');

    const cashIn = await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${cashSessionId}/movements`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        type: 'CASH_IN',
        amount: '20.00',
        description: 'Synthetic cash in.',
        idempotencyKey: `cash-in-${suffix}`,
      })
      .expect(201);
    expect(cashIn.body.expectedCashAmount).toBe('520.00');

    const cashOut = await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${cashSessionId}/movements`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        type: 'CASH_OUT',
        amount: '5.00',
        description: 'Synthetic cash out.',
        idempotencyKey: `cash-out-${suffix}`,
      })
      .expect(201);
    expect(cashOut.body.expectedCashAmount).toBe('515.00');

    const variance = await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${cashSessionId}/close`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        closingAmount: '500.00',
        idempotencyKey: `cash-close-variance-${suffix}`,
      })
      .expect(400);
    expect(variance.body.code).toBe('cash_variance_reason_required');

    const closed = await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${cashSessionId}/close`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        closingAmount: '515.00',
        idempotencyKey: `cash-close-${suffix}`,
      })
      .expect(201);

    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.expectedCashAmount).toBe('515.00');
    expect(closed.body.variance).toBe('0.00');

    const closeReplay = await request(app.getHttpServer())
      .post(`/api/v1/cash-sessions/${cashSessionId}/close`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        closingAmount: '515.00',
        idempotencyKey: `cash-close-replay-${suffix}`,
      })
      .expect(201);
    expect(closeReplay.body.id).toBe(cashSessionId);
  });

  it('runs the night audit idempotently and supports a controlled reopen', async () => {
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/operational-days/close')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        operationalDate: today,
        idempotencyKey: `night-audit-blocked-${suffix}`,
      })
      .expect(409);
    expect(blocked.body.code).toBe('night_audit_blocked');
    expect(Array.isArray(blocked.body.details.blockers)).toBe(true);

    const closed = await request(app.getHttpServer())
      .post('/api/v1/operational-days/close')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        operationalDate: today,
        force: true,
        forceReason: 'Synthetic E2E forced close.',
        idempotencyKey: `night-audit-${suffix}`,
      })
      .expect(201);

    operationalCloseId = closed.body.id;
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.snapshot.forced).toBe(true);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/operational-days/close')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        operationalDate: today,
        force: true,
        forceReason: 'Synthetic E2E forced close.',
        idempotencyKey: `night-audit-${suffix}`,
      })
      .expect(201);
    expect(replay.body.id).toBe(operationalCloseId);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/operational-days/close')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        operationalDate: today,
        force: true,
        forceReason: 'Synthetic E2E forced close.',
        idempotencyKey: `night-audit-other-${suffix}`,
      })
      .expect(409);
    expect(duplicate.body.code).toBe('operational_day_already_closed');

    const reopened = await request(app.getHttpServer())
      .post(`/api/v1/operational-days/${operationalCloseId}/reopen`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        reason: 'Synthetic E2E reopen for correction.',
        idempotencyKey: `night-audit-reopen-${suffix}`,
      })
      .expect(201);
    expect(reopened.body.status).toBe('REOPENED');

    const reclosed = await request(app.getHttpServer())
      .post('/api/v1/operational-days/close')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        operationalDate: today,
        force: true,
        forceReason: 'Synthetic E2E re-close.',
        idempotencyKey: `night-audit-reclose-${suffix}`,
      })
      .expect(201);
    expect(reclosed.body.status).toBe('CLOSED');
  });

  it('writes an append-only audit trail for financial mutations', async () => {
    const events = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'Folio', limit: 50 })
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    const actions = events.body.items.map((item: { action: string }) => item.action);
    expect(actions).toEqual(expect.arrayContaining(['folio.opened']));

    const charges = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'FolioLine', limit: 50 })
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(charges.body.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(['folio.charge_posted']),
    );

    const payments = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'Payment', limit: 50 })
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(payments.body.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(['folio.payment_recorded']),
    );

    const cash = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'CashSession', limit: 50 })
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(cash.body.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(['cash_session.opened', 'cash_session.closed']),
    );

    // Org B never sees tenant A's financial audit rows.
    const foreign = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'Folio', limit: 50 })
      .set(headers(ADMIN_B, ORG_B, '00000000-0000-4000-8000-000000000005'))
      .expect(200);
    expect(foreign.body.items).toHaveLength(0);
  });
});
