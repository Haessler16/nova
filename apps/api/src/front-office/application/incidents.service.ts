import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentSeverity, IncidentStatus, IncidentType, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { requirePropertyContext } from '../../inventory/room-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIncidentDto,
  ListIncidentsQueryDto,
  ResolveIncidentDto,
} from '../dto/front-office.dto';
import { lockRow } from '../infrastructure/row-locks';
import type { IncidentResponse, Transaction } from './front-office.contracts';

const INCIDENT_SELECT = {
  id: true,
  roomId: true,
  reservationId: true,
  stayId: true,
  type: true,
  severity: true,
  status: true,
  title: true,
  description: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  room: { select: { id: true, number: true } },
  reservation: { select: { id: true, code: true } },
  stay: { select: { id: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof INCIDENT_SELECT }>;

/**
 * Operational incidents attached to a room, a reservation or a stay. They are
 * notes for the property team, not billing or guest-facing documents.
 */
@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    context: TenantContext,
    query: ListIncidentsQueryDto,
  ): Promise<{ items: IncidentResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const take = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.roomId !== undefined ? { roomId: query.roomId } : {}),
        ...(query.reservationId !== undefined ? { reservationId: query.reservationId } : {}),
        ...(query.stayId !== undefined ? { stayId: query.stayId } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: INCIDENT_SELECT,
    });

    return { items: rows.map(mapIncident) };
  }

  async create(context: TenantContext, dto: CreateIncidentDto): Promise<IncidentResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const scope = await this.resolveScope(transaction, context, propertyId, dto);

      const incident = await transaction.incident.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          roomId: scope.roomId,
          reservationId: scope.reservationId,
          stayId: dto.stayId,
          type: dto.type ?? IncidentType.NOTE,
          severity: dto.severity ?? IncidentSeverity.MEDIUM,
          status: IncidentStatus.OPEN,
          title: dto.title.trim(),
          description: dto.description.trim(),
          createdByUserId: context.actor.id,
        },
        select: INCIDENT_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'incident.created',
          entityType: 'Incident',
          entityId: incident.id,
          correlationId: context.correlationId,
          metadata: {
            type: incident.type,
            severity: incident.severity,
            roomId: incident.roomId,
            reservationId: incident.reservationId,
            stayId: incident.stayId,
          },
        },
        transaction,
      );

      return mapIncident(incident);
    });
  }

  async resolve(
    context: TenantContext,
    incidentId: string,
    dto: ResolveIncidentDto,
  ): Promise<IncidentResponse> {
    const propertyId = requirePropertyContext(context);
    const resolution = dto.resolution.trim();

    return this.prisma.$transaction(async (transaction) => {
      await lockRow(transaction, 'Incident', {
        organizationId: context.organizationId,
        propertyId,
        id: incidentId,
      });

      const current = await transaction.incident.findFirstOrThrow({
        where: { id: incidentId },
        select: INCIDENT_SELECT,
      });
      if (current.status === IncidentStatus.RESOLVED) {
        return mapIncident(current);
      }

      const updated = await transaction.incident.update({
        where: { id: incidentId },
        data: {
          status: IncidentStatus.RESOLVED,
          resolution,
          resolvedAt: this.clock.now(),
          resolvedByUserId: context.actor.id,
        },
        select: INCIDENT_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'incident.resolved',
          entityType: 'Incident',
          entityId: updated.id,
          correlationId: context.correlationId,
          metadata: {
            type: updated.type,
            severity: updated.severity,
            roomId: updated.roomId,
          },
        },
        transaction,
      );

      return mapIncident(updated);
    });
  }

  /**
   * A stay defines the scope of the incident, so room and reservation must agree
   * with it. Without a stay, the reservation fills in the room when it has one.
   */
  private async resolveScope(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    dto: CreateIncidentDto,
  ): Promise<{ roomId: string | undefined; reservationId: string | undefined }> {
    let roomId = dto.roomId;
    let reservationId = dto.reservationId;

    if (dto.stayId !== undefined) {
      const stay = await transaction.stay.findFirst({
        where: {
          id: dto.stayId,
          organizationId: context.organizationId,
          propertyId,
        },
        select: { id: true, roomId: true, reservationId: true },
      });
      if (stay === null) {
        throw new NotFoundException({
          code: 'stay_not_found',
          message: 'Stay not found in the selected property.',
        });
      }
      if (
        (roomId !== undefined && roomId !== stay.roomId) ||
        (reservationId !== undefined && reservationId !== stay.reservationId)
      ) {
        throw new ConflictException({
          code: 'incident_scope_mismatch',
          message: 'The incident scope does not match the selected stay.',
        });
      }
      roomId = stay.roomId;
      reservationId = stay.reservationId;
    }

    if (roomId !== undefined) {
      await this.assertRoomInProperty(transaction, context.organizationId, propertyId, roomId);
    }
    if (reservationId !== undefined) {
      const reservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          organizationId: context.organizationId,
          propertyId,
        },
        select: { id: true, roomId: true },
      });
      if (reservation === null) {
        throw new NotFoundException({
          code: 'reservation_not_found',
          message: 'Reservation not found in the selected property.',
        });
      }
      if (roomId === undefined && reservation.roomId !== null) {
        roomId = reservation.roomId;
      }
    }

    return { roomId, reservationId };
  }

  private async assertRoomInProperty(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<void> {
    const room = await transaction.room.findFirst({
      where: { id: roomId, organizationId, propertyId },
      select: { id: true },
    });
    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }
  }
}

function mapIncident(row: IncidentRow): IncidentResponse {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    room: row.room,
    reservation: row.reservation,
    stay: row.stay,
    createdBy: row.createdBy,
    resolvedBy: row.resolvedBy,
  };
}
