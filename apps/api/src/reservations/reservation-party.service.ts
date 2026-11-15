import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuestAgeGroup,
  GuestDocumentType,
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
import { AddReservationGuestDto, UpdateReservationGuestDto } from './dto/reservation.dto';
import {
  classifyAgeGroup,
  evaluatePartyReadiness,
  PartyMemberForReadiness,
} from './reservation-party';
import { formatCalendarDate, parseCalendarDate } from './reservation-dates';

const PARTY_RESERVATION_SELECT = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  organizationId: true,
  propertyId: true,
  code: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  guestId: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  roomType: { select: { capacityAdults: true, capacityChildren: true } },
  guests: {
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
      guest: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          documentType: true,
          documentNumber: true,
          fnrhProfile: { select: { birthDate: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
});

type PartyReservationRow = Prisma.ReservationGetPayload<{
  select: typeof PARTY_RESERVATION_SELECT;
}>;
type PartyRow = PartyReservationRow['guests'][number];
type PartyMemberRow = {
  id: string | null;
  guestId: string;
  role: ReservationGuestRole;
  legalIncapacity: boolean;
  minorSupervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleReservationGuestId: string | null;
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    documentType: GuestDocumentType | null;
    documentNumber: string | null;
    fnrhProfile: { birthDate: Date | null } | null;
  };
};
type Transaction = Prisma.TransactionClient;

export interface ReservationPartyMemberResponse {
  reservationGuestId: string | null;
  guestId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  birthDate: string | null;
  ageAtCheckIn: number | null;
  ageGroup: GuestAgeGroup;
  role: ReservationGuestRole;
  legalIncapacity: boolean;
  minorSupervision: MinorSupervision | null;
  authorizationReference: string | null;
  responsibleReservationGuestId: string | null;
  responsibleName: string | null;
}

export interface ReservationPartyResponse {
  reservationId: string;
  code: string;
  status: ReservationStatus;
  primary: ReservationPartyMemberResponse | null;
  companions: ReservationPartyMemberResponse[];
  summary: {
    adults: number;
    minors: number;
    unknown: number;
    declaredAdults: number;
    declaredChildren: number;
  };
  readiness: {
    checkIn: 'ALLOWED' | 'BLOCKED';
    fnrh: 'READY' | 'INCOMPLETE' | 'BLOCKED';
    codes: string[];
    legalCodes: string[];
  };
}

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
    return this.mapParty(reservation);
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

      const guest = await this.resolveGuest(transaction, context, propertyId, dto);
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

      const birthDate = this.resolveBirthDate(guest, dto.birthDate);
      const ageGroup = classifyAgeGroup(birthDate, reservation.checkInDate);
      if (ageGroup === GuestAgeGroup.UNKNOWN) {
        throw new BadRequestException({
          code: 'birth_date_required',
          message: 'A birth date is required to classify an adult or minor.',
        });
      }

      const legalIncapacity = dto.legalIncapacity === true;
      if (ageGroup === GuestAgeGroup.MINOR && legalIncapacity) {
        throw new BadRequestException({
          code: 'minor_cannot_be_legal_incapacity',
          message: 'A minor cannot be marked as legally incapable in this flow.',
        });
      }

      const responsible = this.resolveResponsible(
        party,
        dto.responsibleReservationGuestId,
        ageGroup === GuestAgeGroup.MINOR || legalIncapacity,
        reservation.checkInDate,
      );
      const supervision = this.resolveSupervision(ageGroup, dto.minorSupervision);
      this.assertAuthorizationReference(supervision, dto.authorizationReference);

      await transaction.guestFnrhProfile.upsert({
        where: { guestId: guest.id },
        create: {
          guestId: guest.id,
          organizationId: context.organizationId,
          propertyId,
          birthDate,
        },
        update: { birthDate },
        select: { guestId: true },
      });

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
          authorizationReference:
            supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
              ? dto.authorizationReference?.trim() || null
              : null,
          origin: ReservationGuestOrigin.MANUAL,
          responsibleReservationGuestId: responsible?.id ?? null,
        },
        select: { id: true },
      });

      await this.syncReservationCounts(transaction, reservation, [
        ...party,
        {
          ...primary,
          guest,
          id: created.id,
          guestId: guest.id,
          role: ReservationGuestRole.COMPANION,
          ageGroup,
          legalIncapacity,
          minorSupervision: supervision,
          authorizationReference:
            supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
              ? dto.authorizationReference?.trim() || null
              : null,
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

      return this.mapParty(
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
      const ageGroup = classifyAgeGroup(nextBirthDate, reservation.checkInDate);
      const legalIncapacity =
        dto.legalIncapacity !== undefined ? dto.legalIncapacity : current.legalIncapacity;

      if (
        current.role === ReservationGuestRole.PRIMARY &&
        (ageGroup === GuestAgeGroup.MINOR || legalIncapacity)
      ) {
        throw new BadRequestException({
          code: 'primary_must_be_adult',
          message: 'The primary guest must be an adult and legally capable.',
        });
      }
      if (ageGroup === GuestAgeGroup.MINOR && legalIncapacity) {
        throw new BadRequestException({
          code: 'minor_cannot_be_legal_incapacity',
          message: 'A minor cannot be marked as legally incapable in this flow.',
        });
      }

      const otherParty = reservation.guests.filter((row) => row.id !== current.id);
      const requiresResponsible = ageGroup === GuestAgeGroup.MINOR || legalIncapacity;
      const responsible = this.resolveResponsible(
        otherParty,
        dto.responsibleReservationGuestId ?? current.responsibleReservationGuestId ?? undefined,
        requiresResponsible,
        reservation.checkInDate,
      );
      const supervision =
        ageGroup === GuestAgeGroup.MINOR
          ? this.resolveSupervision(
              ageGroup,
              dto.minorSupervision ?? current.minorSupervision ?? undefined,
            )
          : null;
      const authorizationReference =
        supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
          ? ((dto.authorizationReference ?? current.authorizationReference)?.trim() ?? null)
          : null;
      this.assertAuthorizationReference(supervision, authorizationReference ?? undefined);

      if (
        dto.fullName !== undefined ||
        dto.email !== undefined ||
        dto.phone !== undefined ||
        dto.documentType !== undefined ||
        dto.documentNumber !== undefined
      ) {
        this.assertDocumentPair(
          dto.documentType !== undefined ? dto.documentType : guest.documentType,
          dto.documentNumber !== undefined ? dto.documentNumber : guest.documentNumber,
        );
        await transaction.guest.update({
          where: { id: guest.id },
          data: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
            ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
            ...(dto.documentType !== undefined ? { documentType: dto.documentType } : {}),
            ...(dto.documentNumber !== undefined
              ? { documentNumber: dto.documentNumber.trim().toUpperCase() }
              : {}),
          },
          select: { id: true },
        });
      }

      if (nextBirthDate !== null) {
        await transaction.guestFnrhProfile.upsert({
          where: { guestId: guest.id },
          create: {
            guestId: guest.id,
            organizationId: context.organizationId,
            propertyId,
            birthDate: nextBirthDate,
          },
          update: { birthDate: nextBirthDate },
          select: { guestId: true },
        });
      }

      const updated = await transaction.reservationGuest.update({
        where: { id: current.id },
        data: {
          ageGroup,
          legalIncapacity,
          minorSupervision: supervision,
          authorizationReference:
            supervision === MinorSupervision.UNACCOMPANIED_AUTHORIZED
              ? authorizationReference
              : null,
          responsibleReservationGuestId: requiresResponsible ? (responsible?.id ?? null) : null,
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
                ageGroup,
                legalIncapacity,
                minorSupervision: supervision,
                authorizationReference,
                responsibleReservationGuestId: requiresResponsible
                  ? (responsible?.id ?? null)
                  : null,
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
          ageGroup,
        },
      });

      return this.mapParty(
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

      return this.mapParty(
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

    const created = await transaction.reservationGuest.create({
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
        guest: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            documentType: true,
            documentNumber: true,
            fnrhProfile: { select: { birthDate: true } },
          },
        },
      },
    });
    return created;
  }

  private async resolveGuest(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    dto: AddReservationGuestDto,
  ) {
    if (dto.guestId !== undefined) {
      const guest = await transaction.guest.findFirst({
        where: {
          id: dto.guestId,
          organizationId: context.organizationId,
          propertyId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          documentType: true,
          documentNumber: true,
          fnrhProfile: { select: { birthDate: true } },
        },
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
    this.assertDocumentPair(dto.documentType, dto.documentNumber);
    const guest = await transaction.guest.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        fullName: dto.fullName.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        phone: dto.phone?.trim() ?? null,
        documentType: dto.documentType ?? null,
        documentNumber: dto.documentNumber?.trim().toUpperCase() ?? null,
      },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        fnrhProfile: { select: { birthDate: true } },
      },
    });
    return guest;
  }

  private resolveBirthDate(
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

  private resolveResponsible(
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

  private resolveSupervision(
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

  private assertAuthorizationReference(
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

  private assertDocumentPair(
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

  private async syncReservationCounts(
    transaction: Transaction,
    reservation: PartyReservationRow,
    rows: PartyRow[],
  ): Promise<void> {
    const members = rows.map((row) => this.toReadinessMember(row));
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

  private mapParty(reservation: PartyReservationRow): ReservationPartyResponse {
    const sourceRows: PartyMemberRow[] = reservation.guests.length
      ? reservation.guests
      : [
          {
            id: null,
            guestId: reservation.guestId,
            role: ReservationGuestRole.PRIMARY,
            legalIncapacity: false,
            minorSupervision: null,
            authorizationReference: null,
            responsibleReservationGuestId: null,
            guest: {
              ...reservation.guest,
              documentType: null,
              documentNumber: null,
              fnrhProfile: null,
            },
          },
        ];
    const members = sourceRows.map((row) => this.toResponseMember(row, reservation.checkInDate));
    const namesById = new Map(
      members
        .filter((member) => member.reservationGuestId !== null)
        .map((member) => [member.reservationGuestId as string, member.fullName]),
    );
    for (const member of members) {
      member.responsibleName =
        member.responsibleReservationGuestId === null
          ? null
          : (namesById.get(member.responsibleReservationGuestId) ?? null);
    }
    const primary = members.find((member) => member.role === ReservationGuestRole.PRIMARY) ?? null;
    const companions = members.filter((member) => member.role !== ReservationGuestRole.PRIMARY);
    const readiness = evaluatePartyReadiness({
      members: sourceRows.map((row) => this.toReadinessMember(row)),
      checkInDate: reservation.checkInDate,
      primaryGuestId: reservation.guestId,
      declaredAdults: reservation.adults,
      declaredChildren: reservation.children,
    });
    return {
      reservationId: reservation.id,
      code: reservation.code,
      status: reservation.status,
      primary,
      companions,
      summary: {
        adults: readiness.counts.adults,
        minors: readiness.counts.minors,
        unknown: readiness.counts.unknown,
        declaredAdults: reservation.adults,
        declaredChildren: reservation.children,
      },
      readiness: {
        checkIn: readiness.checkInBlocked ? 'BLOCKED' : 'ALLOWED',
        fnrh: readiness.legalCodes.length
          ? 'BLOCKED'
          : readiness.fnrhReady
            ? 'READY'
            : 'INCOMPLETE',
        codes: readiness.codes,
        legalCodes: readiness.legalCodes,
      },
    };
  }

  private toResponseMember(row: PartyMemberRow, checkInDate: Date): ReservationPartyMemberResponse {
    const birthDate = row.guest.fnrhProfile?.birthDate ?? null;
    const age = birthDate ? ageAtDate(birthDate, checkInDate) : null;
    const ageGroup = classifyAgeGroup(birthDate, checkInDate);
    return {
      reservationGuestId: row.id,
      guestId: row.guestId,
      fullName: row.guest.fullName,
      email: row.guest.email,
      phone: row.guest.phone,
      documentType: row.guest.documentType,
      documentNumber: row.guest.documentNumber,
      birthDate: birthDate ? formatCalendarDate(birthDate) : null,
      ageAtCheckIn: age,
      ageGroup,
      role: row.role,
      legalIncapacity: row.legalIncapacity,
      minorSupervision: row.minorSupervision,
      authorizationReference: row.authorizationReference,
      responsibleReservationGuestId: row.responsibleReservationGuestId,
      responsibleName: null,
    };
  }

  private toReadinessMember(row: PartyMemberRow): PartyMemberForReadiness {
    return {
      id: row.id,
      guestId: row.guestId,
      role: row.role,
      birthDate: row.guest.fnrhProfile?.birthDate ?? null,
      documentType: row.guest.documentType,
      documentNumber: row.guest.documentNumber,
      legalIncapacity: row.legalIncapacity,
      minorSupervision: row.minorSupervision,
      authorizationReference: row.authorizationReference,
      responsibleReservationGuestId: row.responsibleReservationGuestId,
    };
  }
}

function ageAtDate(birthDate: Date, checkInDate: Date): number {
  const age = checkInDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    checkInDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (checkInDate.getUTCMonth() === birthDate.getUTCMonth() &&
      checkInDate.getUTCDate() < birthDate.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}
