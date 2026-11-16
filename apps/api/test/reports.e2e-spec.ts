import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { propertyCalendarDate as propertyToday } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';
const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';
const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';

function headers(userId: string, organizationId = ORG_A, propertyId = PROPERTY_CENTRO) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Reports (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const today = propertyToday();
  const tomorrow = addDays(today, 1);
  const suffix = Date.now().toString(36).toUpperCase();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const guest = await prisma.guest.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        fullName: '=SUM(1,1) Report E2E',
        notes: 'Synthetic report export fixture.',
      },
    });
    await prisma.reservation.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        code: `RPT-${suffix}`,
        status: 'CONFIRMED',
        checkInDate: new Date(`${today}T00:00:00.000Z`),
        checkOutDate: new Date(`${tomorrow}T00:00:00.000Z`),
        adults: 1,
        guestId: guest.id,
        roomTypeId: ROOM_TYPE_STD,
        source: `reports-e2e-${suffix}`,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a catalog with report-specific permissions', async () => {
    const reception = await request(app.getHttpServer())
      .get('/api/v1/reports')
      .set(headers(RECEPTION))
      .expect(200);

    expect(reception.body.items).toHaveLength(5);
    const cash = reception.body.items.find((item: { key: string }) => item.key === 'cash-daily');
    expect(cash.allowed).toBe(false);
    expect(cash.permission).toBe('reports.financial');

    const denied = await request(app.getHttpServer())
      .get('/api/v1/reports')
      .set(headers(HOUSEKEEPER))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
  });

  it('runs occupancy with a fixed query and returns property/day metadata', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reports/occupancy/run')
      .set(headers(RECEPTION))
      .send({ filters: { from: today, to: today }, page: 1, pageSize: 50 })
      .expect(201);

    expect(response.body.reportKey).toBe('occupancy');
    expect(response.body.property.id).toBe(PROPERTY_CENTRO);
    expect(response.body.timezone).toBe('America/Sao_Paulo');
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0].date).toBe(today);
    expect(response.body.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'averageOccupancy' }),
        expect.objectContaining({ key: 'sellableRoomNights' }),
      ]),
    );
  });

  it('paginates arrivals and includes the synthetic guest without leaking SQL', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reports/arrivals/run')
      .set(headers(RECEPTION))
      .send({ filters: { from: today, to: today }, page: 1, pageSize: 1 })
      .expect(201);

    expect(response.body.rows).toHaveLength(1);
    expect(response.body.pageSize).toBe(1);
    expect(response.body.totalRows).toBeGreaterThanOrEqual(1);
    expect(response.body.totalPages).toBeGreaterThanOrEqual(1);
    expect(response.body.rows[0]).toHaveProperty('guest');

    const rejected = await request(app.getHttpServer())
      .post('/api/v1/reports/arrivals/run')
      .set(headers(RECEPTION))
      .send({ filters: { from: today, to: addDays(today, 63) } })
      .expect(400);
    expect(rejected.body.code).toBe('report_filter_invalid');
  });

  it('enforces the financial permission on the cash report', async () => {
    const denied = await request(app.getHttpServer())
      .post('/api/v1/reports/cash-daily/run')
      .set(headers(RECEPTION))
      .send({ filters: { from: today, to: today } })
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
    expect(denied.body.details.required).toContain('reports.financial');

    const allowed = await request(app.getHttpServer())
      .post('/api/v1/reports/cash-daily/run')
      .set(headers(ADMIN))
      .send({ filters: { from: today, to: today } })
      .expect(201);
    expect(allowed.body.rows).toHaveLength(1);
    expect(allowed.body.summary).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'netCash' })]),
    );
  });

  it('exports CSV with metadata, totals and formula-injection protection', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reports/arrivals/exports')
      .set(headers(ADMIN))
      .send({ format: 'CSV', filters: { from: today, to: today } })
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
        stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-disposition']).toContain('nova-report-arrivals');
    const body = response.body as Buffer;
    expect(body.subarray(0, 3).toString()).toBe('\uFEFF');
    const csv = body.toString('utf8');
    expect(csv).toContain('Reporte,Llegadas');
    expect(csv).toContain('Zona horaria,America/Sao_Paulo');
    expect(csv).toContain("'=SUM(1,1) Report E2E");
  });

  it('exports an A4 landscape PDF and records audit metadata only', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reports/occupancy/exports')
      .set(headers(ADMIN))
      .send({ format: 'PDF', filters: { from: today, to: today } })
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
        stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const audit = await prisma.auditEvent.findFirst({
      where: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        action: 'report.exported',
        entityType: 'ReportExecution',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({
      reportKey: 'occupancy',
      format: 'PDF',
      from: today,
      to: today,
    });

    const history = await request(app.getHttpServer())
      .get('/api/v1/reports/executions')
      .set(headers(ADMIN))
      .expect(200);
    expect(history.body.items[0].action).toBe('report.exported');
  });

  it('keeps reports tenant-scoped', async () => {
    const wrongTenant = await request(app.getHttpServer())
      .post('/api/v1/reports/occupancy/run')
      .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
      .send({ filters: { from: today, to: today } })
      .expect(201);
    expect(wrongTenant.body.property.id).toBe(PROPERTY_BOSQUE);

    const wrongOrganization = await request(app.getHttpServer())
      .post('/api/v1/reports/occupancy/run')
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .send({ filters: { from: today, to: today } })
      .expect(403);
    expect(wrongOrganization.body.code).toBe('organization_access_denied');
  });
});
