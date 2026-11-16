import type { INestApplication } from '@nestjs/common';
import { HousekeepingState, ReservationGuestRole } from '@prisma/client';
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

const ROOM_TYPE_STD = '00000000-0000-4000-8000-000000000041';
const PROPERTY_TIMEZONE = 'America/Sao_Paulo';

function headers(userId: string, organizationId = ORG_A, propertyId = PROPERTY_CENTRO) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

function calendarDate(offsetDays: number): string {
  // Check-in is evaluated against the property's local calendar date. Using
  // the host's UTC date fails when local time is still the previous day.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

describe('Reservation party (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36).toUpperCase();
  const today = calendarDate(0);
  const tomorrow = calendarDate(1);
  const future = calendarDate(180);
  const futureOut = calendarDate(181);

  let roomA: string;
  let roomB: string;
  let roomC: string;
  let guestSequence = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const [{ present, profilePresent }] = await prisma.$queryRaw<
      Array<{ present: boolean; profilePresent: boolean }>
    >`
      SELECT
        to_regclass('"ReservationGuest"') IS NOT NULL AS present,
        to_regclass('"GuestFnrhProfile"') IS NOT NULL AS "profilePresent"
    `;
    if (!present || !profilePresent) {
      throw new Error(
        'Reservation party tables do not exist. Apply migration 20261115120000_phase10_reservation_party before running this suite.',
      );
    }

    // Dedicated rooms keep the check-in cases independent from demo/seeded stays.
    const rooms = await Promise.all(
      ['A', 'B', 'C'].map((label) =>
        prisma.room.create({
          data: {
            organizationId: ORG_A,
            propertyId: PROPERTY_CENTRO,
            roomTypeId: ROOM_TYPE_STD,
            number: `PRT-${suffix.slice(-6)}-${label}`,
            floor: '8',
            building: 'E2E',
            housekeepingState: HousekeepingState.CLEAN,
          },
          select: { id: true },
        }),
      ),
    );
    roomA = rooms[0].id;
    roomB = rooms[1].id;
    roomC = rooms[2].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createReservation(input: {
    checkInDate?: string;
    checkOutDate?: string;
    adults?: number;
    children?: number;
    roomId?: string;
    code?: string;
  }) {
    guestSequence += 1;
    const guest = await request(app.getHttpServer())
      .post('/api/v1/guests')
      .set(headers(ADMIN))
      .send({
        fullName: `Party Primary ${suffix}-${guestSequence}`,
        documentType: 'PASSPORT',
        documentNumber: `E2E-P-PRIMARY-${suffix}-${guestSequence}`,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set(headers(RECEPTION))
      .send({
        checkInDate: input.checkInDate ?? future,
        checkOutDate: input.checkOutDate ?? futureOut,
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        guestId: guest.body.id,
        roomTypeId: ROOM_TYPE_STD,
        ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        source: 'party-e2e',
      })
      .expect(201);
    return {
      ...(response.body as { id: string; code: string }),
      guestId: guest.body.id as string,
    };
  }

  async function getParty(reservationId: string, user = RECEPTION) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}/party`)
      .set(headers(user))
      .expect(200);
    return response.body as {
      primary: {
        reservationGuestId: string;
        guestId: string;
        fullName: string;
        ageGroup: string;
      } | null;
      companions: Array<{
        reservationGuestId: string;
        guestId: string;
        fullName: string;
        ageGroup: string;
        minorSupervision: string | null;
      }>;
      summary: { adults: number; minors: number; unknown: number };
      readiness: { checkIn: string; fnrh: string; codes: string[]; legalCodes: string[] };
    };
  }

  async function setPrimaryBirthDate(reservationId: string): Promise<string> {
    const party = await getParty(reservationId);
    expect(party.primary).not.toBeNull();
    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/party/${party.primary?.reservationGuestId}`)
      .set(headers(RECEPTION))
      .send({ birthDate: '1990-01-01' })
      .expect(200);
    return party.primary?.reservationGuestId as string;
  }

  it('creates one primary row and keeps FNRH incomplete without blocking check-in', async () => {
    const reservation = await createReservation({});
    const party = await getParty(reservation.id);

    expect(party.primary).not.toBeNull();
    expect(party.primary?.guestId).toBe(reservation.guestId);
    expect(party.primary?.reservationGuestId).toEqual(expect.any(String));
    expect(party.summary).toMatchObject({ adults: 1, minors: 0, unknown: 1 });
    expect(party.readiness.checkIn).toBe('ALLOWED');
    expect(party.readiness.fnrh).toBe('INCOMPLETE');

    const primaryCount = await prisma.reservationGuest.count({
      where: { reservationId: reservation.id, role: ReservationGuestRole.PRIMARY },
    });
    expect(primaryCount).toBe(1);
  });

  it('links an existing adult, adds a minor and validates duplicate/primary rules', async () => {
    const reservation = await createReservation({});
    const primaryId = await setPrimaryBirthDate(reservation.id);

    const existing = await request(app.getHttpServer())
      .post('/api/v1/guests')
      .set(headers(ADMIN))
      .send({
        fullName: `Existing Adult ${suffix}`,
        email: `existing-${suffix.toLowerCase()}@demo.nova.local`,
        documentType: 'CPF',
        documentNumber: `E2E-CPF-${suffix}`,
      })
      .expect(201);

    const adult = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({ guestId: existing.body.id, birthDate: '1988-06-14' })
      .expect(201);

    expect(adult.body.companions).toHaveLength(1);
    expect(adult.body.companions[0].guestId).toBe(existing.body.id);
    expect(adult.body.companions[0].ageGroup).toBe('ADULT');

    const minor = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({
        fullName: `Minor ${suffix}`,
        birthDate: '2014-05-10',
        minorSupervision: 'ACCOMPANIED',
        responsibleReservationGuestId: primaryId,
      })
      .expect(201);

    expect(minor.body.summary).toMatchObject({ adults: 2, minors: 1, unknown: 0 });
    expect(minor.body.readiness.checkIn).toBe('ALLOWED');
    expect(minor.body.readiness.fnrh).toBe('READY');

    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({ guestId: existing.body.id, birthDate: '1988-06-14' })
      .expect(409);
    expect(duplicate.body.code).toBe('guest_already_in_party');

    const removePrimary = await request(app.getHttpServer())
      .delete(`/api/v1/reservations/${reservation.id}/party/${primaryId}`)
      .set(headers(RECEPTION))
      .expect(409);
    expect(removePrimary.body.code).toBe('primary_guest_cannot_be_removed');

    const authorized = await request(app.getHttpServer())
      .patch(
        `/api/v1/reservations/${reservation.id}/party/${
          (minor.body.companions as Array<{ reservationGuestId: string }>)[
            (minor.body.companions as Array<{ reservationGuestId: string }>).length - 1
          ].reservationGuestId
        }`,
      )
      .set(headers(RECEPTION))
      .send({
        minorSupervision: 'UNACCOMPANIED_AUTHORIZED',
        authorizationReference: `AUTH-${suffix}`,
      })
      .expect(200);

    expect(authorized.body.readiness.checkIn).toBe('ALLOWED');
    expect(authorized.body.readiness.fnrh).toBe('READY');
    expect(
      (authorized.body.companions as Array<{ minorSupervision: string | null }>).some(
        (member) => member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED',
      ),
    ).toBe(true);
  });

  it('creates a new adult and rejects capacity overflow and a missing birth date', async () => {
    const reservation = await createReservation({});
    await setPrimaryBirthDate(reservation.id);

    const missingBirthDate = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({ fullName: `No Birth Date ${suffix}` })
      .expect(400);
    expect(missingBirthDate.body.code).toBe('birth_date_required');

    await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({
        fullName: `New Adult ${suffix}`,
        birthDate: '1985-03-20',
        documentType: 'CPF',
        documentNumber: `E2E-CPF-NEW-${suffix}`,
      })
      .expect(201);

    const overCapacity = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({
        fullName: `Capacity Adult ${suffix}`,
        birthDate: '1991-09-09',
        documentType: 'CPF',
        documentNumber: `E2E-CPF-CAP-${suffix}`,
      })
      .expect(400);

    expect(overCapacity.body.code).toBe('party_exceeds_room_capacity');
  });

  it('blocks check-in for an unauthorized minor and allows it after authorization', async () => {
    const reservation = await createReservation({
      roomId: roomA,
      checkInDate: today,
      checkOutDate: tomorrow,
    });
    const primaryId = await setPrimaryBirthDate(reservation.id);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({
        fullName: `Minor Blocked ${suffix}`,
        birthDate: '2013-02-15',
        minorSupervision: 'ACCOMPANIED',
        responsibleReservationGuestId: primaryId,
      })
      .expect(201);

    const minorId = (created.body.companions as Array<{ reservationGuestId: string }>)[0]
      .reservationGuestId;

    const withoutAuthorization = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/party/${minorId}`)
      .set(headers(RECEPTION))
      .send({ minorSupervision: 'UNACCOMPANIED_WITHOUT_AUTHORIZATION' })
      .expect(200);

    expect(withoutAuthorization.body.readiness.checkIn).toBe('BLOCKED');
    expect(withoutAuthorization.body.readiness.legalCodes).toContain('MINOR_AUTHORIZATION_MISSING');

    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservation.id}/check-in`)
      .set(headers(RECEPTION))
      .expect(409);

    expect(blocked.body.code).toBe('reservation_party_check_in_blocked');
    expect(blocked.body.details.codes).toContain('MINOR_AUTHORIZATION_MISSING');

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/party/${minorId}`)
      .set(headers(RECEPTION))
      .send({
        minorSupervision: 'UNACCOMPANIED_AUTHORIZED',
        authorizationReference: `AUTH-${suffix}`,
      })
      .expect(200);

    const checkedIn = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservation.id}/check-in`)
      .set(headers(RECEPTION))
      .expect(201);

    expect(checkedIn.body.reservation.status).toBe('CHECKED_IN');

    const immutable = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(RECEPTION))
      .send({
        fullName: `After Check-in ${suffix}`,
        birthDate: '1990-01-01',
      })
      .expect(409);

    expect(immutable.body.code).toBe('reservation_party_not_editable');
  });

  it('allows check-in with an incomplete FNRH', async () => {
    const reservation = await createReservation({
      roomId: roomB,
      checkInDate: today,
      checkOutDate: tomorrow,
    });

    const checkedIn = await request(app.getHttpServer())
      .post(`/api/v1/front-office/reservations/${reservation.id}/check-in`)
      .set(headers(RECEPTION))
      .expect(201);

    expect(checkedIn.body.reservation.status).toBe('CHECKED_IN');

    const party = await getParty(reservation.id);
    expect(party.readiness.checkIn).toBe('ALLOWED');
    expect(party.readiness.fnrh).toBe('INCOMPLETE');
    expect(party.readiness.codes).toContain('PROFILE_INCOMPLETE');
  });

  it('keeps the primary row aligned when the reservation guest changes', async () => {
    const reservation = await createReservation({});
    const replacement = await request(app.getHttpServer())
      .post('/api/v1/guests')
      .set(headers(ADMIN))
      .send({
        fullName: `Replacement Primary ${suffix}`,
        documentType: 'PASSPORT',
        documentNumber: `E2E-P-REPL-${suffix}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}`)
      .set(headers(RECEPTION))
      .send({ guestId: replacement.body.id })
      .expect(200);

    const party = await getParty(reservation.id);
    expect(party.primary?.guestId).toBe(replacement.body.id);

    const count = await prisma.reservationGuest.count({
      where: { reservationId: reservation.id, role: ReservationGuestRole.PRIMARY },
    });
    expect(count).toBe(1);
  });

  it('enforces permissions and tenant scope', async () => {
    const reservation = await createReservation({ roomId: roomC });

    const housekeeperRead = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(HOUSEKEEPER))
      .expect(403);
    expect(housekeeperRead.body.code).toBe('permission_denied');

    const housekeeperWrite = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(HOUSEKEEPER))
      .send({ fullName: `Denied ${suffix}`, birthDate: '1990-01-01' })
      .expect(403);
    expect(housekeeperWrite.body.code).toBe('permission_denied');

    const wrongOrganization = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(ADMIN_B, ORG_A, PROPERTY_CENTRO))
      .expect(403);
    expect(wrongOrganization.body.code).toBe('organization_access_denied');

    const wrongProperty = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(AUDITOR, ORG_A, PROPERTY_PRAIA))
      .expect(404);
    expect(wrongProperty.body.code).toBe('reservation_not_found');

    const validRead = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservation.id}/party`)
      .set(headers(ADMIN))
      .expect(200);
    expect(validRead.body.reservationId).toBe(reservation.id);
  });
});
