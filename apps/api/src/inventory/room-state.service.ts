import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomBlockType, RoomOperationalState } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';

export interface ReconciliationScope {
  organizationId: string;
  propertyId: string;
  correlationId?: string;
}

type RoomRow = {
  id: string;
  number: string;
  operationalState: RoomOperationalState;
};

/**
 * Centralizes operational-state derivation so room blocks, lazy expiry and
 * reads all agree. The room row is locked before a state transition; the
 * PostgreSQL exclusion constraint remains the final overlap authority.
 */
@Injectable()
export class RoomStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async reconcileProperty(scope: ReconciliationScope): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const expiredBlocks = await transaction.roomBlock.findMany({
        where: {
          organizationId: scope.organizationId,
          propertyId: scope.propertyId,
          status: 'ACTIVE',
          endsAt: { lte: now },
        },
        select: { id: true, roomId: true, endsAt: true, type: true },
      });

      for (const block of expiredBlocks) {
        await transaction.roomBlock.update({
          where: { id: block.id },
          data: {
            status: 'EXPIRED',
            releasedAt: block.endsAt,
            releaseReason: 'Automatically expired at the end of the block interval.',
          },
        });

        await this.audit.append(
          {
            organizationId: scope.organizationId,
            propertyId: scope.propertyId,
            action: 'room.block_expired',
            entityType: 'RoomBlock',
            entityId: block.id,
            correlationId: scope.correlationId,
            metadata: {
              roomId: block.roomId,
              type: block.type,
              endsAt: block.endsAt.toISOString(),
            },
          },
          transaction,
        );
      }

      // Serialize state reconciliation for this property. Without the lock two
      // concurrent reads could write conflicting history entries.
      await transaction.$queryRaw`
        SELECT "id" FROM "Room"
        WHERE "organizationId" = ${scope.organizationId}::uuid
          AND "propertyId" = ${scope.propertyId}::uuid
          AND "status" = 'ACTIVE'
        FOR UPDATE
      `;

      const rooms = await transaction.room.findMany({
        where: {
          organizationId: scope.organizationId,
          propertyId: scope.propertyId,
          status: 'ACTIVE',
        },
        select: { id: true, number: true, operationalState: true },
      });

      const desiredByRoom = await this.desiredStatesForProperty(transaction, scope, now);

      for (const room of rooms) {
        const desired = desiredByRoom.get(room.id) ?? RoomOperationalState.AVAILABLE;
        if (room.operationalState !== desired) {
          await this.applyOperationalState(transaction, {
            organizationId: scope.organizationId,
            propertyId: scope.propertyId,
            room,
            desired,
            reason: 'Room block interval reconciliation.',
            correlationId: scope.correlationId,
            actorUserId: undefined,
          });
        }
      }
    });
  }

  async lockRoom(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<RoomRow> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Room"
      WHERE "id" = ${roomId}::uuid
        AND "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    const room = await transaction.room.findFirst({
      where: { id: roomId, organizationId, propertyId },
      select: { id: true, number: true, operationalState: true },
    });

    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    return room;
  }

  async assertNoOverlappingActiveBlock(
    transaction: Prisma.TransactionClient,
    input: {
      organizationId: string;
      propertyId: string;
      roomId: string;
      startsAt: Date;
      endsAt: Date;
    },
  ): Promise<void> {
    const overlap = await transaction.roomBlock.findFirst({
      where: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        roomId: input.roomId,
        status: 'ACTIVE',
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true, type: true, startsAt: true, endsAt: true },
    });

    if (overlap !== null) {
      throw new ConflictException({
        code: 'room_block_overlap',
        message: 'The room already has an active block overlapping this interval.',
        details: {
          blockId: overlap.id,
          type: overlap.type,
          startsAt: overlap.startsAt.toISOString(),
          endsAt: overlap.endsAt.toISOString(),
        },
      });
    }
  }

  async recomputeRoomState(
    transaction: Prisma.TransactionClient,
    input: {
      organizationId: string;
      propertyId: string;
      room: RoomRow;
      actorUserId?: string;
      correlationId?: string;
      reason: string;
    },
  ): Promise<RoomOperationalState> {
    const desired = await this.desiredStateForRoom(
      transaction,
      input.organizationId,
      input.propertyId,
      input.room.id,
      new Date(),
    );

    if (desired !== input.room.operationalState) {
      await this.applyOperationalState(transaction, {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        room: input.room,
        desired,
        reason: input.reason,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
      });
    }

    return desired;
  }

  private async desiredStatesForProperty(
    transaction: Prisma.TransactionClient,
    scope: ReconciliationScope,
    now: Date,
  ): Promise<Map<string, RoomOperationalState>> {
    const blocks = await transaction.roomBlock.findMany({
      where: {
        organizationId: scope.organizationId,
        propertyId: scope.propertyId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { roomId: true, type: true },
    });

    const desired = new Map<string, RoomOperationalState>();
    for (const block of blocks) {
      const state = this.stateForBlockType(block.type);
      if (state === RoomOperationalState.OUT_OF_ORDER || !desired.has(block.roomId)) {
        desired.set(block.roomId, state);
      }
    }
    return desired;
  }

  private async desiredStateForRoom(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    propertyId: string,
    roomId: string,
    now: Date,
  ): Promise<RoomOperationalState> {
    const blocks = await transaction.roomBlock.findMany({
      where: {
        organizationId,
        propertyId,
        roomId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { type: true },
    });

    if (blocks.some((block) => block.type === RoomBlockType.OUT_OF_ORDER)) {
      return RoomOperationalState.OUT_OF_ORDER;
    }
    if (blocks.length > 0) {
      return RoomOperationalState.OUT_OF_SERVICE;
    }
    return RoomOperationalState.AVAILABLE;
  }

  private stateForBlockType(type: RoomBlockType): RoomOperationalState {
    return type === RoomBlockType.OUT_OF_ORDER
      ? RoomOperationalState.OUT_OF_ORDER
      : RoomOperationalState.OUT_OF_SERVICE;
  }

  private async applyOperationalState(
    transaction: Prisma.TransactionClient,
    input: {
      organizationId: string;
      propertyId: string;
      room: RoomRow;
      desired: RoomOperationalState;
      reason: string;
      actorUserId?: string;
      correlationId?: string;
    },
  ): Promise<void> {
    await transaction.room.update({
      where: { id: input.room.id },
      data: { operationalState: input.desired },
      select: { id: true },
    });

    await transaction.roomStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        roomId: input.room.id,
        category: 'OPERATIONAL',
        fromState: input.room.operationalState,
        toState: input.desired,
        reason: input.reason,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
      },
      select: { id: true },
    });

    await this.audit.append(
      {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        action: 'room.operational_state_changed',
        entityType: 'Room',
        entityId: input.room.id,
        correlationId: input.correlationId,
        reason: input.reason,
        metadata: {
          roomNumber: input.room.number,
          from: input.room.operationalState,
          to: input.desired,
        },
      },
      transaction,
    );
  }
}

export function requirePropertyContext(context: TenantContext): string {
  if (context.propertyId === undefined) {
    throw new BadRequestException({
      code: 'property_context_required',
      message: 'This operation requires property context.',
    });
  }
  return context.propertyId;
}
