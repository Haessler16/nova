import { GuestAgeGroup, MinorSupervision, ReservationGuestRole } from '@prisma/client';
import {
  ageAtCheckIn,
  classifyAgeGroup,
  evaluatePartyReadiness,
  type PartyMemberForReadiness,
} from './reservation-party';

const checkInDate = '2026-11-20';

function member(
  overrides: Partial<PartyMemberForReadiness> & Pick<PartyMemberForReadiness, 'id' | 'guestId'>,
): PartyMemberForReadiness {
  return {
    role: ReservationGuestRole.COMPANION,
    birthDate: '1990-01-01',
    documentType: 'CPF',
    documentNumber: '12345678901',
    legalIncapacity: false,
    minorSupervision: null,
    authorizationReference: null,
    responsibleReservationGuestId: null,
    ...overrides,
  };
}

const primary = member({
  id: 'rg-primary',
  guestId: 'guest-primary',
  role: ReservationGuestRole.PRIMARY,
});

function readiness(members: PartyMemberForReadiness[], declaredAdults = 1, declaredChildren = 0) {
  return evaluatePartyReadiness({
    members,
    checkInDate,
    primaryGuestId: primary.guestId,
    declaredAdults,
    declaredChildren,
  });
}

describe('reservation party age classification', () => {
  it('calculates the age on the check-in date and the birthday boundary', () => {
    expect(ageAtCheckIn('2008-11-20', checkInDate)).toBe(18);
    expect(ageAtCheckIn('2008-11-21', checkInDate)).toBe(17);
    expect(classifyAgeGroup('2008-11-20', checkInDate)).toBe(GuestAgeGroup.ADULT);
    expect(classifyAgeGroup('2008-11-21', checkInDate)).toBe(GuestAgeGroup.MINOR);
    expect(classifyAgeGroup(null, checkInDate)).toBe(GuestAgeGroup.UNKNOWN);
  });
});

describe('reservation party readiness', () => {
  it('is ready when the party matches the declaration and a minor is authorized', () => {
    const minor = member({
      id: 'rg-minor',
      guestId: 'guest-minor',
      birthDate: '2015-05-10',
      role: ReservationGuestRole.COMPANION,
      minorSupervision: MinorSupervision.UNACCOMPANIED_AUTHORIZED,
      authorizationReference: 'AUTH-1',
      responsibleReservationGuestId: primary.id,
    });

    const result = readiness([primary, minor], 1, 1);

    expect(result.counts).toEqual({ adults: 1, minors: 1, unknown: 0 });
    expect(result.codes).toEqual([]);
    expect(result.checkInBlocked).toBe(false);
    expect(result.fnrhReady).toBe(true);
  });

  it('blocks check-in when a minor has no authorization', () => {
    const minor = member({
      id: 'rg-minor',
      guestId: 'guest-minor',
      birthDate: '2015-05-10',
      minorSupervision: MinorSupervision.UNACCOMPANIED_WITHOUT_AUTHORIZATION,
      responsibleReservationGuestId: primary.id,
    });

    const result = readiness([primary, minor], 1, 1);

    expect(result.codes).toContain('MINOR_AUTHORIZATION_MISSING');
    expect(result.legalCodes).toContain('MINOR_AUTHORIZATION_MISSING');
    expect(result.checkInBlocked).toBe(true);
  });

  it('blocks check-in when an authorized minor has no authorization reference', () => {
    const minor = member({
      id: 'rg-minor',
      guestId: 'guest-minor',
      birthDate: '2015-05-10',
      minorSupervision: MinorSupervision.UNACCOMPANIED_AUTHORIZED,
      responsibleReservationGuestId: primary.id,
    });

    const result = readiness([primary, minor], 1, 1);

    expect(result.codes).toContain('MINOR_AUTHORIZATION_REFERENCE_MISSING');
    expect(result.checkInBlocked).toBe(true);
  });

  it('rejects a minor as the responsible adult', () => {
    const minorResponsible = member({
      id: 'rg-minor-responsible',
      guestId: 'guest-minor-responsible',
      birthDate: '2010-01-01',
    });
    const minor = member({
      id: 'rg-minor',
      guestId: 'guest-minor',
      birthDate: '2016-01-01',
      minorSupervision: MinorSupervision.ACCOMPANIED,
      responsibleReservationGuestId: minorResponsible.id,
    });

    const result = readiness([primary, minorResponsible, minor], 1, 2);

    expect(result.codes).toContain('MINOR_RESPONSIBLE_MISSING');
    expect(result.checkInBlocked).toBe(true);
  });

  it('allows check-in with an unknown legacy party but keeps FNRH incomplete', () => {
    const legacy = member({
      id: 'rg-primary',
      guestId: 'guest-primary',
      role: ReservationGuestRole.PRIMARY,
      birthDate: null,
      documentType: null,
      documentNumber: null,
    });

    const result = evaluatePartyReadiness({
      members: [legacy],
      checkInDate,
      primaryGuestId: legacy.guestId,
      declaredAdults: 1,
      declaredChildren: 0,
    });

    expect(result.checkInBlocked).toBe(false);
    expect(result.fnrhReady).toBe(false);
    expect(result.codes).toEqual(
      expect.arrayContaining([
        'AGE_GROUP_UNKNOWN',
        'PROFILE_INCOMPLETE',
        'DOCUMENT_NOT_FNRH_READY',
      ]),
    );
  });

  it('does not block check-in for a party count mismatch alone', () => {
    const result = readiness([primary], 2, 0);

    expect(result.codes).toContain('GUEST_COUNT_MISMATCH');
    expect(result.checkInBlocked).toBe(false);
    expect(result.fnrhReady).toBe(false);
  });

  it('flags a primary row that does not match the reservation primary guest', () => {
    const stalePrimary = member({
      id: 'rg-primary',
      guestId: 'guest-old-primary',
      role: ReservationGuestRole.PRIMARY,
    });

    const result = readiness([stalePrimary]);

    expect(result.codes).toContain('PRIMARY_MISSING');
    expect(result.fnrhReady).toBe(false);
  });
});
