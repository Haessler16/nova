import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FolioStatus, HousekeepingState, ReservationStatus, StayStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { propertyCalendarDate as calendarDate } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';
const PROPERTY_B = '00000000-0000-4000-8000-000000000005';

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

describe('Catalog, consumptions and coordinated checkout (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);

  let roomId: string;
  let reservationId: string;
  let stayId: string;
  let folioId: string;
  let productId: string;
  let inactiveProductId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // A dedicated clean room keeps the suite independent from seeded demo stays.
    const room = await prisma.room.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        roomTypeId: ROOM_TYPE_STD,
        number: `E2E-P4-${suffix.slice(-4)}`,
        floor: '8',
        building: 'E2E',
        housekeepingState: HousekeepingState.CLEAN,
      },
      select: { id: true },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates the property catalog with tenant-scoped permissions', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        sku: `MINI-${suffix}`,
        name: 'Água mineral 500ml',
        description: 'Consumo de minibar.',
        category: 'MINIBAR',
        unit: 'UN',
        unitAmount: '7.50',
      })
      .expect(201);

    productId = created.body.id;
    expect(created.body.unitAmount).toBe('7.50');
    expect(created.body.currencyCode).toBe('BRL');
    expect(created.body.isActive).toBe(true);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({ sku: `MINI-${suffix}`, name: 'Duplicado', unitAmount: '1.00' })
      .expect(409);
    expect(duplicate.body.code).toBe('product_sku_exists');

    const wrongCurrency = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        sku: `USD-${suffix}`,
        name: 'Producto en dólares',
        unitAmount: '3.00',
        currencyCode: 'USD',
      })
      .expect(400);
    expect(wrongCurrency.body.code).toBe('currency_mismatch');

    const denied = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/products?search=MINI-${suffix}`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(productId);

    // Another property of the same organization never sees this SKU.
    const otherProperty = await request(app.getHttpServer())
      .get(`/api/v1/products?search=MINI-${suffix}`)
      .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
      .expect(200);
    expect(otherProperty.body.items).toHaveLength(0);

    const foreignProduct = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN_B, ORG_B, PROPERTY_B))
      .send({ sku: `ORG-B-${suffix}`, name: 'Producto org B', unitAmount: '2.00' })
      .expect(201);
    expect(foreignProduct.body.id).toBeDefined();
  });

  it('updates the catalog price and deactivates a product', async () => {
    const inactive = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({
        sku: `PARK-${suffix}`,
        name: 'Estacionamiento',
        category: 'PARKING',
        unitAmount: '25.00',
      })
      .expect(201);
    inactiveProductId = inactive.body.id;

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/products/${inactiveProductId}`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);

    const repriced = await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({ unitAmount: '8.00' })
      .expect(200);
    expect(repriced.body.unitAmount).toBe('8.00');

    const foreignUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
      .send({ unitAmount: '9.00' })
      .expect(404);
    expect(foreignUpdate.body.code).toBe('product_not_found');
  });

  it('checks a guest in so the folio can be closed at checkout', async () => {
    const reservation = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        roomId,
        source: `catalog-checkout-${suffix}`,
      })
      .expect(201);
    reservationId = reservation.body.id;

    const checkIn = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservationId}/check-in`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);
    stayId = checkIn.body.stay.id;
    expect(checkIn.body.stay.status).toBe('IN_HOUSE');

    const folio = await request(app.getHttpServer())
      .post('/api/v1/folios')
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ reservationId, idempotencyKey: `catalog-folio-${suffix}` })
      .expect(201);
    folioId = folio.body.id;
    expect(folio.body.status).toBe('OPEN');
  });

  it('posts a catalog consumption with a server-side price snapshot', async () => {
    const posted = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        productId,
        quantity: '3',
        idempotencyKey: `consume-1-${suffix}`,
      })
      .expect(201);

    expect(posted.body.totals.charges).toBe('24.00');
    const line = posted.body.lines[0];
    expect(line.description).toBe('Água mineral 500ml');
    expect(line.amount).toBe('24.00');
    expect(line.quantity).toBe('3.00');
    expect(line.unitAmount).toBe('8.00');
    expect(line.unit).toBe('UN');
    expect(line.source).toBe('MINIBAR');
    expect(line.productId).toBe(productId);

    // A client-supplied amount is ignored: PostgreSQL prices the consumption.
    const forged = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        productId,
        quantity: '1',
        amount: '0.01',
        idempotencyKey: `consume-forged-${suffix}`,
      })
      .expect(201);
    expect(forged.body.lines[1].amount).toBe('8.00');
    expect(forged.body.totals.charges).toBe('32.00');

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        productId,
        quantity: '3',
        idempotencyKey: `consume-1-${suffix}`,
      })
      .expect(201);
    expect(replay.body.lines).toHaveLength(2);
    expect(replay.body.totals.charges).toBe('32.00');
  });

  it('rejects inactive, foreign and catalog-less charges', async () => {
    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        productId: inactiveProductId,
        quantity: '1',
        idempotencyKey: `consume-inactive-${suffix}`,
      })
      .expect(409);
    expect(inactive.body.code).toBe('product_inactive');

    const foreignProduct = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
      .send({ sku: `PRAIA-${suffix}`, name: 'Producto playa', unitAmount: '4.00' })
      .expect(201);

    const crossProperty = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        productId: foreignProduct.body.id,
        quantity: '1',
        idempotencyKey: `consume-foreign-${suffix}`,
      })
      .expect(404);
    expect(crossProperty.body.code).toBe('product_not_found');

    const missingPayload = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ idempotencyKey: `consume-empty-${suffix}` })
      .expect(400);
    expect(missingPayload.body.code).toBe('charge_payload_required');

    const manual = await request(app.getHttpServer())
      .post(`/api/v1/folios/${folioId}/charges`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        description: 'Estacionamiento manual',
        amount: '10.00',
        source: 'PARKING',
        idempotencyKey: `consume-manual-${suffix}`,
      })
      .expect(201);
    expect(manual.body.totals.charges).toBe('42.00');
    const manualLine = manual.body.lines[manual.body.lines.length - 1];
    expect(manualLine.source).toBe('PARKING');
    expect(manualLine.productId).toBeNull();
    expect(manualLine.quantity).toBe('1.00');
  });

  it('exposes the checkout readiness of the stay and its accounts', async () => {
    const readiness = await request(app.getHttpServer())
      .get(`/api/v1/front-office/stays/${stayId}/checkout-readiness`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(200);

    expect(readiness.body.stay.room.id).toBe(roomId);
    expect(readiness.body.canCheckOut).toBe(true);
    expect(readiness.body.totals).toEqual({
      charges: '42.00',
      payments: '0.00',
      balance: '42.00',
    });
    expect(readiness.body.housekeeping).toEqual({ current: 'CLEAN', target: 'DIRTY' });
    expect(readiness.body.warnings.map((item: { code: string }) => item.code)).toContain(
      'folio_balance_outstanding',
    );

    const denied = await request(app.getHttpServer())
      .get(`/api/v1/front-office/stays/${stayId}/checkout-readiness`)
      .set(headers(HOUSEKEEPER, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
  });

  it('never releases the room when the account cannot be closed', async () => {
    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(409);
    expect(rejected.body.code).toBe('folio_balance_outstanding');
    expect(rejected.body.details.folios[0].balance).toBe('42.00');

    const stay = await prisma.stay.findUniqueOrThrow({ where: { id: stayId } });
    expect(stay.status).toBe(StayStatus.IN_HOUSE);
    expect(stay.checkedOutAt).toBeNull();

    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(room.housekeepingState).toBe(HousekeepingState.CLEAN);

    const folio = await prisma.folio.findUniqueOrThrow({ where: { id: folioId } });
    expect(folio.status).toBe(FolioStatus.OPEN);
    expect(folio.closedAt).toBeNull();

    const missingReason = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({ allowOutstandingBalance: true })
      .expect(400);
    expect(missingReason.body.code).toBe('balance_reason_required');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(reservation.status).toBe(ReservationStatus.CHECKED_IN);
  });

  it('closes account, stay and housekeeping in one audited checkout', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .send({
        notes: 'Checkout sintético E2E.',
        allowOutstandingBalance: true,
        balanceReason: 'Saldo autorizado por la gerencia en el piloto.',
      })
      .expect(201);

    expect(response.body.status).toBe('CHECKED_OUT');
    expect(response.body.checkout.outstandingBalance).toBe(true);
    expect(response.body.checkout.totals).toEqual({
      charges: '42.00',
      payments: '0.00',
      balance: '42.00',
    });
    expect(response.body.checkout.folios[0].status).toBe('SETTLED');
    expect(response.body.checkout.housekeeping).toEqual({ from: 'CLEAN', to: 'DIRTY' });

    const folio = await prisma.folio.findUniqueOrThrow({ where: { id: folioId } });
    expect(folio.status).toBe(FolioStatus.SETTLED);
    expect(folio.closedAt).not.toBeNull();

    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(room.housekeepingState).toBe(HousekeepingState.DIRTY);

    const housekeepingHistory = await prisma.roomStatusHistory.findFirst({
      where: { roomId, category: 'HOUSEKEEPING' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(housekeepingHistory?.toState).toBe('DIRTY');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(reservation.status).toBe(ReservationStatus.CHECKED_OUT);

    const events = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({ entityType: 'Folio', limit: 50 })
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .expect(200);
    const closure = events.body.items.find(
      (item: { action: string; entityId: string }) =>
        item.action === 'folio.closed_at_checkout' && item.entityId === folioId,
    );
    expect(closure).toBeDefined();
    expect(closure.reason).toContain('Saldo autorizado');

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/front-office/stays/${stayId}/check-out`)
      .set(headers(RECEPTION, ORG_A, PROPERTY_CENTRO))
      .expect(201);
    expect(replay.body.id).toBe(stayId);

    const auditCount = await prisma.auditEvent.count({
      where: { action: 'folio.closed_at_checkout', entityId: folioId },
    });
    expect(auditCount).toBe(1);
  });
});
