import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  GuestAgeGroup,
  GuestDocumentType,
  MinorSupervision,
  ReservationGuestRole,
} from '@prisma/client';
import type { TenantContext } from '../common/http/request-context';
import type { AddReservationGuestDto } from './dto/reservation.dto';
import { classifyAgeGroup } from './reservation-party';
import type { PartyRow, Transaction } from './reservation-party.contracts';
import { parseCalendarDate } from './reservation-dates';

export interface ResolvedGuest {
  id: string;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  fnrhProfile: { birthDate: Date | null } | null;
}

/** Reuses an existing active guest or creates one from the inline details. */
export async function resolveGuest(
  transaction: Transaction,
  context: TenantContext,
  propertyId: string,
  dto: AddReservationGuestDto,
): Promise<ResolvedGuest> {
  if (dto.guestId !== undefined) {
    const guest = await transaction.guest.findFirst({
      where: {
        id: dto.guestId,
        organizationId: context.organizationId,
        propertyId,
        status: 'ACTIVE',
      },
      select: guestProfileSelect,
    });
    if (guest === null) {
      throw new NotFoundException({
        code: 'guest_not_found',
        message: 'Guest not found in the selected property.',
      });
    }
    return guest;
  }

  if (dto.fullName === undefined || dto.fullName.trim().length < 2) {
    throw new BadRequestException({
      code: 'guest_name_required',
      message: 'Provide a guestId or a full name for the new guest.',
    });
  }
  assertDocumentPair(dto.documentType, dto.documentNumber);
  return transaction.guest.create({
    data: {
      organizationId: context.organizationId,
      propertyId,
      fullName: dto.fullName.trim(),
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null,
      documentType: dto.documentType ?? null,
      documentNumber: dto.documentNumber?.trim().toUpperCase() || null,
    },
    select: guestProfileSelect,
  });
}

const guestProfileSelect = {
  id: true,
  documentType: true,
  documentNumber: true,
  fnrhProfile: { select: { birthDate: true } },
} as const;

export function resolveBirthDate(
  guest: { fnrhProfile: { birthDate: Date | null } | null },
  value: string | undefined,
): Date {
  if (value !== undefined) return parseCalendarDate(value, 'birthDate');
  if (guest.fnrhProfile?.birthDate) return guest.fnrhProfile.birthDate;
  throw new BadRequestException({
    code: 'birth_date_required',
    message: 'A birth date is required to classify an adult or minor.',
  });
}

export function resolveResponsible(
  party: PartyRow[],
  responsibleId: string | undefined,
  required: boolean,
  checkInDate: Date,
): PartyRow | null {
  if (!required) return null;
  if (responsibleId === undefined) {
    throw new BadRequestException({
      code: 'responsible_required',
      message: 'A responsible adult from the same reservation is required.',
    });
  }
  const responsible = party.find((row) => row.id === responsibleId);
  if (responsible === undefined) {
    throw new BadRequestException({
      code: 'responsible_not_in_party',
      message: 'The responsible must belong to the same reservation party.',
    });
  }
  const group = classifyAgeGroup(responsible.guest.fnrhProfile?.birthDate ?? null, checkInDate);
  if (group === GuestAgeGroup.MINOR || responsible.legalIncapacity) {
    throw new BadRequestException({
      code: 'responsible_must_be_adult',
      message: 'The responsible must be an adult and legally capable.',
    });
  }
  return responsible;
}

export function resolveSupervision(
  ageGroup: GuestAgeGroup,
  value: MinorSupervision | undefined,
): MinorSupervision | null {
  if (ageGroup !== GuestAgeGroup.MINOR) return null;
  if (value === undefined || value === MinorSupervision.UNKNOWN) {
    throw new BadRequestException({
      code: 'minor_supervision_required',
      message: 'Indicate how the minor travels.',
    });
  }
  return value;
}

export function assertAuthorizationReference(
  supervision: MinorSupervision | null,
  reference: string | undefined,
): void {
  if (
    supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED &&
    (reference === undefined || reference.trim() === '')
  ) {
    throw new BadRequestException({
      code: 'authorization_reference_required',
      message: 'An internal authorization reference is required for an unaccompanied minor.',
    });
  }
}

export function assertDocumentPair(
  documentType: GuestDocumentType | null | undefined,
  documentNumber: string | null | undefined,
): void {
  const hasType = documentType !== undefined && documentType !== null;
  const hasNumber = documentNumber !== undefined && documentNumber !== null;
  if (hasType !== hasNumber) {
    throw new BadRequestException({
      code: 'invalid_guest_document',
      message: 'documentType and documentNumber must be provided together.',
    });
  }
}

export function assertPrimaryIsAdult(
  role: ReservationGuestRole,
  ageGroup: GuestAgeGroup,
  legalIncapacity: boolean,
): void {
  if (role === ReservationGuestRole.PRIMARY && (ageGroup === GuestAgeGroup.MINOR || legalIncapacity)) {
    throw new BadRequestException({
      code: 'primary_must_be_adult',
      message: 'The primary guest must be an adult and legally capable.',
    });
  }
}

export function assertMinorIsLegallyCapable(ageGroup: GuestAgeGroup, legalIncapacity: boolean): void {
  if (ageGroup === GuestAgeGroup.MINOR && legalIncapacity) {
    throw new BadRequestException({
      code: 'minor_cannot_be_legal_incapacity',
      message: 'A minor cannot be marked as legally incapable in this flow.',
    });
  }
}
