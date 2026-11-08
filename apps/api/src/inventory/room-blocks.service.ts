import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomBlockStatus, RoomBlockType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomBlockDto, ReleaseRoomBlockDto } from './dto/room-block.dto';
import { requirePropertyContext, RoomStateService } from './room-state.service';

export interface RoomBlockResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  roomId: string;
  type: RoomBlockType;
  status: RoomBlockStatus;
  reason: string;
  startsAt: Date;
  endsAt: Date;
  createdByUserId: string | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ROOM_BLOCK_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  roomId: true,
  type: true,
  status: true,
  reason: true,
  startsAt: true,
  endsAt: true,
  createdByUserId: true,
  releasedAt: true,
  releaseReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MAX_BLOCK_DURATION_MS = 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class RoomBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
  ) {}

  async list(context: TenantContext, roomId: string): Promise<{ items: RoomBlockResponse[] }> {
    const propertyId = requirePropertyContext(context);
    await this.assertRoom(context.organizationId, propertyId, roomId);

    const items = await this.prisma.roomBlock.findMany({
      where: { organizationId: context.organizationId, propertyId, roomId },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: ROOM_BLOCK_SELECT,
    });

    return { items };
  }

  async create(
    context: TenantContext,
    roomId: string,
    dto: CreateRoomBlockDto,
  ): Promise<RoomBlockResponse> {
    const propertyId = requirePropertyContext(context);
    this.validateInterval(dto.startsAt, dto.endsAt);

    return this.prisma.$transaction(async (transaction) => {
      const room = await this.roomState.lockRoom(
        transaction,
        context.organizationId,
        propertyId,
        roomId,
      );

      await this.roomState.assertNoOverlappingActiveBlock(transaction, {
        organizationId: context.organizationId,
        propertyId,
        roomId,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      });

      const block = await transaction.roomBlock.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          roomId,
          type: dto.type,
          reason: dto.reason.trim(),
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          createdByUserId: context.actor.id,
        },
        select: ROOM_BLOCK_SELECT,
      });

      await this.roomState.recomputeRoomState(transaction, {
        organizationId: context.organizationId,
        propertyId,
        room,
        actorUserId: context.actor.id,
        correlationId: context.correlationId,
        reason: `Room block created (${block.type}).`,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'room.block_created',
          entityType: 'RoomBlock',
          entityId: block.id,
          correlationId: context.correlationId,
          reason: block.reason,
          metadata: {
            roomId,
            type: block.type,
            startsAt: block.startsAt.toISOString(),
            endsAt: block.endsAt.toISOString(),
          },
        },
        transaction,
      );

      return block;
    });
  }

  async release(
    context: TenantContext,
    roomId: string,
    blockId: string,
    dto: ReleaseRoomBlockDto,
  ): Promise<RoomBlockResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const room = await this.roomState.lockRoom(
        transaction,
        context.organizationId,
        propertyId,
        roomId,
      );

      const block = await transaction.roomBlock.findFirst({
        where: {
          id: blockId,
          organizationId: context.organizationId,
          propertyId,
          roomId,
        },
        select: ROOM_BLOCK_SELECT,
      });

      if (block === null) {
        throw new NotFoundException({
          code: 'room_block_not_found',
          message: 'Room block not found in the selected room.',
        });
      }

      if (block.status !== RoomBlockStatus.ACTIVE) {
        throw new ConflictException({
          code: 'room_block_not_active',
          message: 'Only an active room block can be released.',
          details: { status: block.status },
        });
      }

      const releaseReason = dto.reason?.trim() ?? 'Released by user.';
      const released = await transaction.roomBlock.update({
        where: { id: block.id },
        data: {
          status: RoomBlockStatus.RELEASED,
          releasedAt: new Date(),
          releaseReason,
        },
        select: ROOM_BLOCK_SELECT,
      });

      await this.roomState.recomputeRoomState(transaction, {
        organizationId: context.organizationId,
        propertyId,
        room,
        actorUserId: context.actor.id,
        correlationId: context.correlationId,
        reason: `Room block released (${block.type}).`,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'room.block_released',
          entityType: 'RoomBlock',
          entityId: block.id,
          correlationId: context.correlationId,
          reason: releaseReason,
          metadata: {
            roomId,
            type: block.type,
            startsAt: block.startsAt.toISOString(),
            endsAt: block.endsAt.toISOString(),
          },
        },
        transaction,
      );

      return released;
    });
  }

  private validateInterval(startsAt: Date, endsAt: Date): void {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException({
        code: 'invalid_room_block_interval',
        message: 'Block start and end must be valid instants.',
      });
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException({
        code: 'invalid_room_block_interval',
        message: 'Block end must be after its start.',
      });
    }

    if (endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_DURATION_MS) {
      throw new BadRequestException({
        code: 'room_block_too_long',
        message: 'A room block cannot exceed 366 days.',
      });
    }

    if (endsAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'room_block_interval_in_past',
        message: 'A new room block must end in the future.',
      });
    }
  }

  private async assertRoom(
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({
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
