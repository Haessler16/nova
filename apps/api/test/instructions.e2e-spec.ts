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
const PROPERTY_BOSQUE = '00000000-0000-4000-8000-000000000005';

const ADMIN = '00000000-0000-4000-8000-000000000011';
const RECEPTION = '00000000-0000-4000-8000-000000000012';
const ADMIN_B = '00000000-0000-4000-8000-000000000014';

const GUEST_ANA = '00000000-0000-4000-8000-000000000061';
const RESERVATION_FUTURE = '00000000-0000-4000-8000-000000000106';

function headers(userId: string, organizationId = ORG_A, propertyId = PROPERTY_CENTRO) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

interface SuggestionBody {
  category: string;
  title: string;
  body: string;
  priority: string;
  status: string;
  sourcePhrase: string;
  confidence: number;
  requiresHumanConfirmation: boolean;
  actionType?: string;
  executionMoment?: string;
  paymentMethod?: string;
  assignedDepartment?: string;
}

describe('Reservation instructions and guest notes (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const reservationId = RESERVATION_FUTURE;
  const paymentText = `RSV COM CAFE / TRF DBL R$ 606,00 + 15% / PGTO DIRETO NO HOTEL (12-15/11) / ${suffix}`;

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

  describe('source note parsing', () => {
    let sourceNoteId: string;
    let paymentSuggestion: SuggestionBody;

    it('parses PGTO DIRETO NO HOTEL into a pending card pre-authorization suggestion without money side effects', async () => {
      const paymentsBefore = await prisma.payment.count({ where: { reservationId } });
      const foliosBefore = await prisma.folio.count({ where: { reservationId } });

      const parsed = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/parse`)
        .set(headers(RECEPTION))
        .send({ text: paymentText, sourceSystem: 'E2E' })
        .expect(201);

      sourceNoteId = parsed.body.id;
      expect(parsed.body.parserVersion).toBe('pt-br-notes-v1');
      expect(parsed.body.redacted).toBe(false);
      expect(parsed.body.warnings.join(' ')).toMatch(/data sem ano/i);

      const suggestions = parsed.body.suggestions as SuggestionBody[];
      const payment = suggestions.find(
        (suggestion) => suggestion.actionType === 'PAYMENT_PREAUTHORIZATION',
      );
      expect(payment).toMatchObject({
        category: 'PAYMENT',
        priority: 'HIGH',
        status: 'NEW',
        executionMoment: 'CHECK_IN',
        paymentMethod: 'CREDIT_CARD',
        requiresHumanConfirmation: true,
      });
      expect(payment?.body).toMatch(/não inicia a pré-autorização/i);
      paymentSuggestion = payment as SuggestionBody;

      const paymentsAfter = await prisma.payment.count({ where: { reservationId } });
      const foliosAfter = await prisma.folio.count({ where: { reservationId } });
      expect(paymentsAfter).toBe(paymentsBefore);
      expect(foliosAfter).toBe(foliosBefore);

      const instructions = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(instructions.body.items).toHaveLength(0);
    });

    it('does not duplicate the source note when the same text is parsed again', async () => {
      const again = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/parse`)
        .set(headers(RECEPTION))
        .send({ text: paymentText })
        .expect(201);

      expect(again.body.id).toBe(sourceNoteId);
    });

    it('redacts card data from the stored source text while keeping a raw-text digest', async () => {
      const parsed = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/parse`)
        .set(headers(RECEPTION))
        .send({ text: 'PGTO DIRETO NO HOTEL / Cartão: 4111 1111 1111 1111 CVV: 123' })
        .expect(201);

      expect(parsed.body.redacted).toBe(true);
      expect(parsed.body.sourceTextOriginal).not.toContain('4111');
      expect(parsed.body.sourceTextOriginal).not.toContain('123');
      expect(parsed.body.sourceTextOriginal).toContain('[CARD_REDACTED]');
      expect(parsed.body.sourceTextHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('only asks for ledger verification when the text claims a cash payment', async () => {
      const parsed = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/parse`)
        .set(headers(RECEPTION))
        .send({ text: 'PGTO DAS DIARIAS OK LANÇADO NO CAIXA' })
        .expect(201);

      const verify = (parsed.body.suggestions as SuggestionBody[]).find(
        (suggestion) => suggestion.actionType === 'VERIFY_PAYMENT',
      );
      expect(verify).toMatchObject({ category: 'PAYMENT', status: 'NEEDS_CLARIFICATION' });
      expect(verify?.body).toMatch(/ledger/i);
    });

    it('confirms suggestions idempotently and creates no payment or folio side effect', async () => {
      const paymentsBefore = await prisma.payment.count({ where: { reservationId } });

      const confirmed = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/${sourceNoteId}/confirm`)
        .set(headers(RECEPTION))
        .send({ suggestions: [paymentSuggestion] })
        .expect(201);

      expect(confirmed.body.created).toHaveLength(1);
      expect(confirmed.body.created[0]).toMatchObject({
        actionType: 'PAYMENT_PREAUTHORIZATION',
        executionMoment: 'CHECK_IN',
        paymentMethod: 'CREDIT_CARD',
        status: 'NEW',
      });

      const retried = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/source-notes/${sourceNoteId}/confirm`)
        .set(headers(RECEPTION))
        .send({ suggestions: [paymentSuggestion] })
        .expect(201);

      expect(retried.body.created).toHaveLength(0);
      expect(retried.body.skipped).toBe(1);

      const paymentsAfter = await prisma.payment.count({ where: { reservationId } });
      expect(paymentsAfter).toBe(paymentsBefore);

      const instructions = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(instructions.body.items).toHaveLength(1);
      expect(instructions.body.items[0].paymentMethod).toBe('CREDIT_CARD');
    });
  });

  describe('instruction lifecycle', () => {
    let instructionId: string;

    it('creates an instruction and records auditable status events', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(RECEPTION))
        .send({
          category: 'IMPORTANT',
          title: `Avisar no check-in ${suffix}`,
          body: 'Recordatorio sintético para el check-in.',
          priority: 'HIGH',
          actionType: 'ARRIVAL_REMINDER',
          executionMoment: 'CHECK_IN',
          assignedDepartment: 'FRONT_DESK',
        })
        .expect(201);

      instructionId = created.body.id;
      expect(created.body.status).toBe('NEW');
      expect(created.body.visibility).toBe('ALL_AUTHORIZED');

      await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions/${instructionId}/acknowledge`)
        .set(headers(RECEPTION))
        .send({})
        .expect(201);

      const completed = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions/${instructionId}/complete`)
        .set(headers(RECEPTION))
        .send({ reason: 'Verificado en el mostrador.' })
        .expect(201);

      expect(completed.body.status).toBe('COMPLETED');
      expect(completed.body.completedAt).not.toBeNull();
      expect(completed.body.completedByUserId).toBe(RECEPTION);

      const events = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions/${instructionId}/events`)
        .set(headers(RECEPTION))
        .expect(200);

      expect(events.body.items.map((event: { eventType: string }) => event.eventType)).toEqual([
        'CREATED',
        'ACKNOWLEDGED',
        'COMPLETED',
      ]);

      const rejected = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions/${instructionId}/dismiss`)
        .set(headers(RECEPTION))
        .send({})
        .expect(409);
      expect(rejected.body.code).toBe('instruction_invalid_transition');
    });

    it('hides confidential and finance-only instructions from reception', async () => {
      const confidential = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(ADMIN))
        .send({
          category: 'CONFIDENTIAL',
          title: `Informação confidencial ${suffix}`,
          body: 'Solo gerencia.',
          priority: 'CRITICAL',
          visibility: 'ALL_AUTHORIZED',
        })
        .expect(201);

      const finance = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(ADMIN))
        .send({
          category: 'BILLING',
          title: `Facturación interna ${suffix}`,
          body: 'Visible solo para finanzas.',
          visibility: 'FINANCE',
        })
        .expect(201);

      const receptionList = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .query({ includeCompleted: 'true' })
        .set(headers(RECEPTION))
        .expect(200);
      const receptionIds = receptionList.body.items.map((item: { id: string }) => item.id);
      expect(receptionIds).not.toContain(confidential.body.id);
      expect(receptionIds).not.toContain(finance.body.id);

      await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions/${confidential.body.id}`)
        .set(headers(RECEPTION))
        .expect(404);

      const adminList = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .query({ includeCompleted: true, limit: 100 })
        .set(headers(ADMIN))
        .expect(200);
      const adminIds = adminList.body.items.map((item: { id: string }) => item.id);
      expect(adminIds).toContain(confidential.body.id);
      expect(adminIds).toContain(finance.body.id);
    });

    it('updates an instruction and records the changed fields', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(RECEPTION))
        .send({
          category: 'ROOM',
          title: `Upgrade sujeto a disponibilidad ${suffix}`,
          body: 'No asignar habitación automáticamente.',
          priority: 'NORMAL',
        })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/reservations/${reservationId}/instructions/${created.body.id}`)
        .set(headers(RECEPTION))
        .send({ priority: 'HIGH', assignedDepartment: 'FRONT_DESK' })
        .expect(200);

      expect(updated.body.priority).toBe('HIGH');
      expect(updated.body.assignedDepartment).toBe('FRONT_DESK');

      const events = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions/${created.body.id}/events`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(events.body.items.map((event: { eventType: string }) => event.eventType)).toEqual([
        'CREATED',
        'UPDATED',
      ]);
    });
  });

  describe('guest notes', () => {
    it('stores persistent guest notes separately from reservation instructions', async () => {
      const note = await request(app.getHttpServer())
        .post(`/api/v1/guests/${GUEST_ANA}/notes`)
        .set(headers(RECEPTION))
        .send({
          category: 'MEAL',
          body: `Prefiere café sin azúcar. ${suffix}`,
          priority: 'NORMAL',
          purpose: 'PREFERENCE',
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/guests/${GUEST_ANA}/notes`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(note.body.id);

      const instructions = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(
        instructions.body.items.some((item: { body: string }) => item.body.includes(suffix)),
      ).toBe(false);
    });

    it('deactivates a guest note and hides it by default', async () => {
      const note = await request(app.getHttpServer())
        .post(`/api/v1/guests/${GUEST_ANA}/notes`)
        .set(headers(RECEPTION))
        .send({ body: `Nota temporal ${suffix}`, priority: 'LOW' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/guests/${GUEST_ANA}/notes/${note.body.id}`)
        .set(headers(RECEPTION))
        .send({ isActive: false })
        .expect(200);

      const active = await request(app.getHttpServer())
        .get(`/api/v1/guests/${GUEST_ANA}/notes`)
        .set(headers(RECEPTION))
        .expect(200);
      expect(active.body.items.map((item: { id: string }) => item.id)).not.toContain(
        note.body.id,
      );

      const all = await request(app.getHttpServer())
        .get(`/api/v1/guests/${GUEST_ANA}/notes`)
        .query({ includeInactive: 'true' })
        .set(headers(RECEPTION))
        .expect(200);
      expect(all.body.items.map((item: { id: string }) => item.id)).toContain(note.body.id);
    });
  });

  describe('tenant and property isolation', () => {
    it('rejects cross-property and cross-tenant access', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(ADMIN, ORG_A, PROPERTY_PRAIA))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/guests/${GUEST_ANA}/notes`)
        .set(headers(ADMIN_B, ORG_B, PROPERTY_BOSQUE))
        .expect(404);
    });

    it('denies write operations to roles without the required permission', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/instructions`)
        .set(headers('00000000-0000-4000-8000-000000000016'))
        .send({ title: 'No permitido', body: 'No debería crearse.' })
        .expect(403);
    });
  });
});
