import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuestAgeGroup,
  MinorSupervision,
  Prisma,
  ReservationGuestOrigin,
  ReservationGuestRole,
  ReservationStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddReservationGuestDto,
  UpdateReservationGuestDto,
} from './dto/reservation.dto';
import { classifyAgeGroup, evaluatePartyReadiness } from './reservation-party';
import {
  PARTY_GUEST_SELECT,
  PARTY_RESERVATION_SELECT,
  type PartyReservationRow,
  type PartyRow,
  type ReservationPartyResponse,
  type Transaction,
} from './reservation-party.contracts';
import { mapPartyResponse } from './reservation-party.mapper';
import {
  assertAuthorizationReference,
  assertMinorIsLegallyCapable,
  resolveBirthDate,
  resolveGuest,
  resolveResponsible,
  resolveSupervision,
} from './reservation-party.rules';
import {
  applyGuestIdentity,
  resolveUpdateRules,
  toReadinessMember,
} from './reservation-party.update';
import { parseCalendarDate } from './reservation-dates';

export type {
  ReservationPartyMemberResponse,
  ReservationPartyResponse,
} from './reservation-party.contracts';

@Injectable()
export class ReservationPartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(context: TenantContext, reservationId: string): Promise<ReservationPartyResponse> {
    const reservation = await this.findPartyReservation(
      this.prisma,
      context,
      requirePropertyContext(context),
      reservationId,
    );
    return mapPartyResponse(reservation);
  }

  async add(
    context: TenantContext,
    reservationId: string,
    dto: AddReservationGuestDto,
  ): Promise<ReservationPartyResponse> {
    const propertyId = requirePropertyContext(context);
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await this.lockPartyReservation(
        transaction,
        context,
        propertyId,
        reservationId,
      );
      this.assertPartyEditable(reservation);
      const primary = await this.ensurePrimary(transaction, reservation, context);
      const party = [primary, ...reservation.guests.filter((row) => row.id !== primary.id)];

      const guest = await resolveGuest(transaction, context, propertyId, dto);
      if (dto.guestId !== undefined && guest.id === reservation.guestId) {
        throw new ConflictException({
          code: 'guest_already_primary',
          message: 'The reservation primary guest is already in the party.',
        });
      }
      if (party.some((row) => row.guestId === guest.id)) {
        throw new ConflictException({
          code: 'guest_already_in_party',
          message: 'That guest is already in this reservation party.',
        });
      }

      const birthDate = resolveBirthDate(guest, dto.birthDate);
      const ageGroup = classifyAgeGroup(birthDate, reservation.checkInDate);
      if (ageGroup === GuestAgeGroup.UNKNOWN) {
        throw new BadRequestException({
          code: 'birth_date_required',
          message: 'A birth date is required to classify an adult or minor.',
        });
      }

      const legalIncapacity = dto.legalIncapacity === true;
      assertMinorIsLegallyCapable(ageGroup, legalIncapacity);

      const responsible = resolveResponsible(
        party,
        dto.responsibleReservationGuestId,
        ageGroup === GuestAgeGroup.MINOR || legalIncapacity,
        reservation.checkInDate,
      );
      const supervision = resolveSupervision(ageGroup, dto.minorSupervision);
      assertAuthorizationReference(supervision, dto.authorizationReference);
      const authorizationReference =
        supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
          ? dto.authorizationReference?.trim() || null
          : null;

      await this.upsertBirthDate(transaction, context, propertyId, guest.id, birthDate);

      const created = await transaction.reservationGuest.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: reservation.id,
          guestId: guest.id,
          role: ReservationGuestRole.COMPANION,
          ageGroup,
          legalIncapacity,
          minorSupervision: supervision,
          authorizationReference,
          origin: ReservationGuestOrigin.MANUAL,
          responsibleReservationGuestId: responsible?.id ?? null,
        },
        select: { id: true },
      });

      // The guest was selected before the profile upsert, so its in-memory
      // fnrhProfile is still null. Reflect the persisted birth date in the
      // party snapshot used for capacity and readiness; otherwise a new minor
      // is counted as an unknown adult.
      await this.syncReservationCounts(transaction, reservation, [
        ...party,
        {
          ...primary,
          guest: { ...guest, fnrhProfile: { birthDate } },
          id: created.id,
          guestId: guest.id,
          role: ReservationGuestRole.COMPANION,
          ageGroup,
          legalIncapacity,
          minorSupervision: supervision,
          authorizationReference,
          responsibleReservationGuestId: responsible?.id ?? null,
        } as PartyRow,
      ]);

      await this.writeHistoryAndAudit(transaction, context, reservation, {
        action: 'reservation.guest_added',
        reason: 'Guest added to the reservation party.',
        auditAction: 'reservation.guest_added',
        metadata: {
          reservationGuestId: created.id,
          role: 'COMPANION',
          ageGroup,
        },
      });

      return mapPartyResponse(
        await this.findPartyReservation(transaction, context, propertyId, reservation.id),
      );
    });
  }

  async update(
    context: TenantContext,
    reservationId: string,
    reservationGuestId: string,
    dto: UpdateReservationGuestDto,
  ): Promise<ReservationPartyResponse> {
    const propertyId = requirePropertyContext(context);
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await this.lockPartyReservation(
        transaction,
        context,
        propertyId,
        reservationId,
      );
      this.assertPartyEditable(reservation);
      const current = reservation.guests.find((row) => row.id === reservationGuestId);
      if (current === undefined) {
        throw new NotFoundException({
          code: 'reservation_guest_not_found',
          message: 'Reservation guest not found in this reservation.',
        });
      }

      const guest = current.guest;
      const nextBirthDate =
        dto.birthDate !== undefined
          ? parseCalendarDate(dto.birthDate, 'birthDate')
          : (guest.fnrhProfile?.birthDate ?? null);
      const rules = resolveUpdateRules(reservation, current, nextBirthDate, dto);

      await applyGuestIdentity(transaction, guest, dto);
      if (nextBirthDate !== null) {
        await this.upsertBirthDate(transaction, context, propertyId, guest.id, nextBirthDate);
      }

      const updated = await transaction.reservationGuest.update({
        where: { id: current.id },
        data: {
          ageGroup: rules.ageGroup,
          legalIncapacity: rules.legalIncapacity,
          minorSupervision: rules.supervision,
          authorizationReference: rules.authorizationReference,
          responsibleReservationGuestId: rules.responsibleId,
        },
        select: { id: true },
      });

      await this.syncReservationCounts(
        transaction,
        reservation,
        reservation.guests.map((row) =>
          row.id === updated.id
            ? {
                ...row,
                guest: {
                  ...row.guest,
                  fnrhProfile: nextBirthDate !== null ? { birthDate: nextBirthDate } : null,
                },
                ageGroup: rules.ageGroup,
                legalIncapacity: rules.legalIncapacity,
                minorSupervision: rules.supervision,
                authorizationReference: rules.authorizationReference,
                responsibleReservationGuestId: rules.responsibleId,
              }
            : row,
        ),
      );

      await this.writeHistoryAndAudit(transaction, context, reservation, {
        action: 'reservation.guest_updated',
        reason: 'Reservation party guest updated.',
        auditAction: 'reservation.guest_updated',
        metadata: {
          reservationGuestId: updated.id,
          ageGroup: rules.ageGroup,
        },
      });

      return mapPartyResponse(
        await this.findPartyReservation(transaction, context, propertyId, reservation.id),
      );
    });
  }

  async remove(
    context: TenantContext,
    reservationId: string,
    reservationGuestId: string,
  ): Promise<ReservationPartyResponse> {
    const propertyId = requirePropertyContext(context);
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await this.lockPartyReservation(
        transaction,
        context,
        propertyId,
        reservationId,
      );
      this.assertPartyEditable(reservation);
      const current = reservation.guests.find((row) => row.id === reservationGuestId);
      if (current === undefined) {
        throw new NotFoundException({
          code: 'reservation_guest_not_found',
          message: 'Reservation guest not found in this reservation.',
        });
      }
      if (current.role === ReservationGuestRole.PRIMARY) {
        throw new ConflictException({
          code: 'primary_guest_cannot_be_removed',
          message: 'The primary guest cannot be removed from the reservation.',
        });
      }
      if (reservation.guests.some((row) => row.responsibleReservationGuestId === current.id)) {
        throw new ConflictException({
          code: 'guest_has_dependents',
          message: 'Reassign the dependents before removing this guest.',
        });
      }

      await transaction.reservationGuest.delete({ where: { id: current.id } });

      await this.syncReservationCounts(
        transaction,
        reservation,
        reservation.guests.filter((row) => row.id !== current.id),
      );

      await this.writeHistoryAndAudit(transaction, context, reservation, {
        action: 'reservation.guest_removed',
        reason: 'Guest removed from the reservation party.',
        auditAction: 'reservation.guest_removed',
        metadata: { reservationGuestId: current.id, role: current.role },
      });

      return mapPartyResponse(
        await this.findPartyReservation(transaction, context, propertyId, reservation.id),
      );
    });
  }

  private async findPartyReservation(
    client: Prisma.TransactionClient | PrismaService,
    context: TenantContext,
    propertyId: string,
    reservationId: string,
  ): Promise<PartyReservationRow> {
    const reservation = await client.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: PARTY_RESERVATION_SELECT,
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }
    return reservation;
  }

  private async lockPartyReservation(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    reservationId: string,
  ): Promise<PartyReservationRow> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Reservation"
      WHERE "id" = ${reservationId}::uuid
        AND "organizationId" = ${context.organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }
    return this.findPartyReservation(transaction, context, propertyId, reservationId);
  }

  private assertPartyEditable(reservation: PartyReservationRow): void {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'reservation_party_not_editable',
        message: 'The party can only be changed while the reservation is confirmed.',
        details: { status: reservation.status },
      });
    }
  }

  private async ensurePrimary(
    transaction: Transaction,
    reservation: PartyReservationRow,
    context: TenantContext,
  ): Promise<PartyRow> {
    const existing = reservation.guests.find((row) => row.role === ReservationGuestRole.PRIMARY);
    if (existing !== undefined) {
      return existing;
    }

    return transaction.reservationGuest.create({
      data: {
        organizationId: context.organizationId,
        propertyId: reservation.propertyId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        role: ReservationGuestRole.PRIMARY,
        ageGroup: GuestAgeGroup.UNKNOWN,
        origin: ReservationGuestOrigin.LEGACY_BACKFILL,
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        reservationId: true,
        guestId: true,
        role: true,
        ageGroup: true,
        legalIncapacity: true,
        minorSupervision: true,
        authorizationReference: true,
        origin: true,
        responsibleReservationGuestId: true,
        guest: { select: PARTY_GUEST_SELECT },
      },
    });
  }

  private async upsertBirthDate(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    guestId: string,
    birthDate: Date,
  ): Promise<void> {
    await transaction.guestFnrhProfile.upsert({
      where: { guestId },
      create: {
        guestId,
        organizationId: context.organizationId,
        propertyId,
        birthDate,
      },
      update: { birthDate },
      select: { guestId: true },
    });
  }

  private async syncReservationCounts(
    transaction: Transaction,
    reservation: PartyReservationRow,
    rows: PartyRow[],
  ): Promise<void> {
    const members = rows.map((row) => toReadinessMember(row));
    const readiness = evaluatePartyReadiness({
      members,
      checkInDate: reservation.checkInDate,
      primaryGuestId: reservation.guestId,
      declaredAdults: reservation.adults,
      declaredChildren: reservation.children,
    });
    if (
      readiness.counts.adults > reservation.roomType.capacityAdults ||
      readiness.counts.minors > reservation.roomType.capacityChildren
    ) {
      throw new BadRequestException({
        code: 'party_exceeds_room_capacity',
        message: 'The reservation party exceeds the room type capacity.',
        details: {
          capacityAdults: reservation.roomType.capacityAdults,
          capacityChildren: reservation.roomType.capacityChildren,
        },
      });
    }
    await transaction.reservation.update({
      where: { id: reservation.id },
      data: {
        adults: readiness.counts.adults,
        children: readiness.counts.minors,
      },
      select: { id: true },
    });
  }

  private async writeHistoryAndAudit(
    transaction: Transaction,
    context: TenantContext,
    reservation: PartyReservationRow,
    input: {
      action: string;
      reason: string;
      auditAction: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    await transaction.reservationHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId: reservation.propertyId,
        reservationId: reservation.id,
        action: input.action,
        fromStatus: reservation.status,
        toStatus: reservation.status,
        reason: input.reason,
        actorUserId: context.actor.id,
        correlationId: context.correlationId,
      },
      select: { id: true },
    });
    await this.audit.append(
      {
        organizationId: context.organizationId,
        propertyId: reservation.propertyId,
        actorUserId: context.actor.id,
        action: input.auditAction,
        entityType: 'Reservation',
        entityId: reservation.id,
        correlationId: context.correlationId,
        metadata: input.metadata,
      },
      transaction,
    );
  }
}
