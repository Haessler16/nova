import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { propertyCalendarDate as calendarDate } from './support/property-date';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000004';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';

const RECEPTION = '00000000-0000-4000-8000-000000000012';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';
const HOUSEKEEPER = '00000000-0000-4000-8000-000000000016';

const GUEST_ANA = '00000000-0000-4000-8000-000000000061';
const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';

function headers(userId: string, organizationId = ORG_A, propertyId = PROPERTY_CENTRO) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

describe('Documents (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);

  let reservationId: string;
  let documentId: string;
  let documentNumber: string;
  let documentHash: string;
  let guestDocumentNumber: string | null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const guest = await prisma.guest.findUnique({
      where: { id: GUEST_ANA },
      select: { documentNumber: true },
    });
    guestDocumentNumber = guest?.documentNumber ?? null;

    const reservation = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION))
      .send({
        checkInDate: today,
        checkOutDate: tomorrow,
        adults: 1,
        guestId: GUEST_ANA,
        roomTypeId: ROOM_TYPE_STD,
        source: `documents-e2e-${suffix}`,
      })
      .expect(201);
    reservationId = reservation.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the three published templates and denies access without documents.read', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v1/documents/templates')
      .set(headers(RECEPTION))
      .expect(200);

    expect(listed.body.items).toHaveLength(3);
    expect(listed.body.items.map((item: { key: string }) => item.key).sort()).toEqual([
      'CHECKIN_SUMMARY',
      'GUEST_REGISTRATION',
      'LODGING_TERMS',
    ]);
    expect(listed.body.items[0]).toHaveProperty('signatureRequired');

    const denied = await request(app.getHttpServer())
      .get('/api/v1/documents/templates')
      .set(headers(HOUSEKEEPER))
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
  });

  it('previews escaped A4 HTML without persisting a document', async () => {
    const before = await prisma.generatedDocument.count({ where: { reservationId } });

    const preview = await request(app.getHttpServer())
      .post('/api/v1/documents/preview')
      .set(headers(RECEPTION))
      .send({ type: 'GUEST_REGISTRATION', reservationId })
      .expect(201);

    expect(preview.body.html).toContain('Ficha de registro de hóspede');
    expect(preview.body.html).toContain('Ana');
    expect(preview.body.html).toContain('Prévia');
    if (guestDocumentNumber !== null) {
      expect(preview.body.html).not.toContain(guestDocumentNumber);
      expect(preview.body.html).toContain('••••');
    }
    expect(await prisma.generatedDocument.count({ where: { reservationId } })).toBe(before);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'document.previewed', entityId: reservationId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('generates an immutable A4 PDF and exposes authenticated download metadata', async () => {
    const generated = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set(headers(RECEPTION))
      .send({ type: 'LODGING_TERMS', reservationId })
      .expect(201);

    documentId = generated.body.id;
    documentNumber = generated.body.number;
    documentHash = generated.body.sha256;

    expect(documentNumber).toMatch(/^DOC-\d{8}-[A-Z0-9]{12}$/);
    expect(documentNumber).toContain(`DOC-${today.replaceAll('-', '')}-`);
    expect(generated.body.status).toBe('GENERATED');
    expect(generated.body.mimeType).toBe('application/pdf');
    expect(generated.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.body.fileSizeBytes).toBeGreaterThan(1000);
    expect(generated.body.pageCount).toBeGreaterThanOrEqual(1);
    expect(generated.body.templateVersion).toBe(1);

    const stored = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      select: { content: true, snapshot: true, sha256: true },
    });
    expect(stored).not.toBeNull();
    expect(
      Buffer.from(stored?.content ?? [])
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    expect(stored?.sha256).toBe(documentHash);
    expect(stored?.snapshot).toMatchObject({
      schemaVersion: 1,
      reservation: { id: reservationId },
      guest: { fullName: 'Ana Souza (demo)' },
    });

    await expect(
      prisma.generatedDocument.update({
        where: { id: documentId },
        data: { snapshot: { tampered: true } },
      }),
    ).rejects.toThrow(/immutable/);

    const download = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}/download`)
      .set(headers(RECEPTION))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
      })
      .expect(200);

    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(download.headers['content-disposition']).toContain(documentNumber);
    expect(download.headers['x-document-sha256']).toBe(documentHash);
    const body = download.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.byteLength).toBe(generated.body.fileSizeBytes);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'document.downloaded', entityId: documentId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('lists history for the reservation and keeps the generated snapshot stable', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .query({ reservationId })
      .set(headers(RECEPTION))
      .expect(200);

    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(documentId);
    expect(listed.body.items[0]).not.toHaveProperty('content');
    expect(listed.body.items[0]).not.toHaveProperty('snapshot');
  });

  it('records print dialog events and physical signature receipt with manage permission', async () => {
    const printEvent = await request(app.getHttpServer())
      .post(`/api/v1/documents/${documentId}/print-events`)
      .set(headers(RECEPTION))
      .send({ type: 'PRINT_DIALOG_OPENED', note: 'Synthetic E2E print request.' })
      .expect(201);

    expect(printEvent.body.type).toBe('PRINT_DIALOG_OPENED');
    expect(printEvent.body.requestedBy.id).toBe(RECEPTION);

    await expect(
      prisma.documentPrintEvent.update({
        where: { id: printEvent.body.id },
        data: { note: 'This update must be rejected.' },
      }),
    ).rejects.toThrow(/append-only/);

    const signed = await request(app.getHttpServer())
      .post(`/api/v1/documents/${documentId}/physical-signature-received`)
      .set(headers(RECEPTION))
      .send({ notes: 'Synthetic E2E signature receipt.' })
      .expect(201);

    expect(signed.body.status).toBe('SIGNATURE_RECEIVED');
    expect(signed.body.receivedAt).toEqual(expect.any(String));
    expect(signed.body.receivedBy.id).toBe(RECEPTION);
    expect(signed.body.printEventCount).toBe(1);

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/documents/${documentId}/physical-signature-received`)
      .set(headers(RECEPTION))
      .expect(201);
    expect(replay.body.status).toBe('SIGNATURE_RECEIVED');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}`)
      .set(headers(RECEPTION))
      .expect(200);
    expect(detail.body.printEvents).toHaveLength(1);
    expect(detail.body.printEvents[0].type).toBe('PRINT_DIALOG_OPENED');
  });

  it('requires a stay for a check-in summary', async () => {
    const rejected = await request(app.getHttpServer())
      .post('/api/v1/documents/preview')
      .set(headers(RECEPTION))
      .send({ type: 'CHECKIN_SUMMARY', reservationId })
      .expect(409);

    expect(rejected.body.code).toBe('document_checkin_required');
  });

  it('enforces tenant scope on document history and download', async () => {
    const wrongTenant = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}`)
      .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
      .expect(404);
    expect(wrongTenant.body.code).toBe('document_not_found');

    const wrongOrganization = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}`)
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(wrongOrganization.body.code).toBe('organization_access_denied');

    const denied = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set(headers(HOUSEKEEPER))
      .send({ type: 'GUEST_REGISTRATION', reservationId })
      .expect(403);
    expect(denied.body.code).toBe('permission_denied');
  });
});
