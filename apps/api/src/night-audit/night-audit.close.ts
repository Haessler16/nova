import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OperationalCloseStatus, Prisma } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { computeOperationalDay } from '../operational-day/operational-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { CloseOperationalDayDto } from './dto/night-audit.dto';
import {
  OPERATIONAL_CLOSE_SELECT,
  type NightAuditProperty,
  type NightAuditSnapshot,
  type OperationalCloseRow,
} from './night-audit.contracts';

export interface CloseScope {
  context: TenantContext;
  propertyId: string;
  operationalDate: Date;
  snapshot: NightAuditSnapshot;
  dto: CloseOperationalDayDto;
}

/** Returns the already persisted close for this idempotency key, if any. */
export async function findCloseReplay(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  dto: CloseOperationalDayDto,
): Promise<OperationalCloseRow | null> {
  const replay = await prisma.operationalClose.findFirst({
    where: {
      organizationId,
      propertyId,
      idempotencyKey: dto.idempotencyKey,
    },
    select: OPERATIONAL_CLOSE_SELECT,
  });
  if (replay === null) {
    return null;
  }
  if (replay.operationalDate.toISOString().slice(0, 10) !== dto.operationalDate) {
    throw idempotencyReuse();
  }
  return replay;
}

export async function loadCloseProperty(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
): Promise<NightAuditProperty> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: {
      timezone: true,
      operationalDayStart: true,
      currencyCode: true,
    },
  });
  if (property === null) {
    throw new NotFoundException({
      code: 'property_not_found',
      message: 'Property not found in this organization.',
    });
  }
  return property;
}

export function assertOperationalDateCloseable(
  operationalDate: string,
  property: NightAuditProperty,
  now: Date,
): void {
  const current = computeOperationalDay(now, property.timezone, property.operationalDayStart);
  if (operationalDate > current.operationalDate) {
    throw new ConflictException({
      code: 'operational_day_in_future',
      message: 'The operational day cannot be closed before it starts.',
      details: { currentOperationalDate: current.operationalDate },
    });
  }
}

/** Blockers stop the close unless the caller forces it with a reason. */
export function assertSnapshotCloseable(
  snapshot: NightAuditSnapshot,
  dto: CloseOperationalDayDto,
): void {
  if (snapshot.blockers.length === 0) {
    return;
  }
  if (dto.force !== true) {
    throw new ConflictException({
      code: 'night_audit_blocked',
      message:
        'The operational day has unresolved items. Review the blockers or force the close with a reason.',
      details: { blockers: snapshot.blockers },
    });
  }
  if ((dto.forceReason ?? '').trim().length < 3) {
    throw new BadRequestException({
      code: 'force_reason_required',
      message: 'A reason is required when forcing the operational day close.',
    });
  }
}

export async function findExistingClose(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  operationalDate: Date,
): Promise<{ id: string; status: OperationalCloseStatus } | null> {
  const existing = await prisma.operationalClose.findFirst({
    where: { organizationId, propertyId, operationalDate },
    select: { id: true, status: true },
  });
  if (existing !== null && existing.status === OperationalCloseStatus.CLOSED) {
    throw new ConflictException({
      code: 'operational_day_already_closed',
      message: 'This operational day is already closed.',
      details: { operationalCloseId: existing.id },
    });
  }
  return existing;
}

export async function writeOperationalClose(
  deps: { prisma: PrismaService; audit: AuditService; closedAt: Date },
  scope: CloseScope,
  existing: { id: string } | null,
): Promise<OperationalCloseRow> {
  const { context, propertyId, operationalDate, snapshot, dto } = scope;
  return deps.prisma.$transaction(async (transaction) => {
    const data = {
      status: OperationalCloseStatus.CLOSED,
      idempotencyKey: dto.idempotencyKey,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      notes: dto.notes ?? null,
      closedByUserId: context.actor.id,
      closedAt: deps.closedAt,
    };
    const row =
      existing !== null
        ? await transaction.operationalClose.update({
            where: { id: existing.id },
            data,
            select: OPERATIONAL_CLOSE_SELECT,
          })
        : await transaction.operationalClose.create({
            data: {
              organizationId: context.organizationId,
              propertyId,
              operationalDate,
              ...data,
            },
            select: OPERATIONAL_CLOSE_SELECT,
          });

    await deps.audit.append(
      {
        organizationId: context.organizationId,
        propertyId,
        actorUserId: context.actor.id,
        action: 'operational_day.closed',
        entityType: 'OperationalClose',
        entityId: row.id,
        correlationId: context.correlationId,
        reason: dto.force === true ? dto.forceReason : undefined,
        metadata: {
          operationalDate: dto.operationalDate,
          forced: snapshot.forced,
          blockers: snapshot.blockers,
          counts: snapshot.counts,
          totals: snapshot.totals,
        },
      },
      transaction,
    );

    return row;
  });
}

function idempotencyReuse(): ConflictException {
  return new ConflictException({
    code: 'idempotency_key_reuse',
    message: 'This idempotency key was already used for a different operational close payload.',
  });
}
