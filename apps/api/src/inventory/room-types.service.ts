import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto, ListRoomTypesQueryDto, UpdateRoomTypeDto } from './dto/room-type.dto';
import { requirePropertyContext } from './room-state.service';

export interface RoomTypeResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
  status: RecordStatus;
  roomCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ROOM_TYPE_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  name: true,
  code: true,
  description: true,
  capacityAdults: true,
  capacityChildren: true,
  bedType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { rooms: true } },
} as const;

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    context: TenantContext,
    query: ListRoomTypesQueryDto,
  ): Promise<{ items: RoomTypeResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const rows = await this.prisma.roomType.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        ...(query.status !== undefined ? { status: query.status } : {}),
      },
      select: ROOM_TYPE_SELECT,
      orderBy: { name: 'asc' },
    });

    return { items: rows.map((row) => this.toResponse(row)) };
  }

  async get(context: TenantContext, roomTypeId: string): Promise<RoomTypeResponse> {
    const propertyId = requirePropertyContext(context);
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: ROOM_TYPE_SELECT,
    });

    if (roomType === null) {
      throw new NotFoundException({
        code: 'room_type_not_found',
        message: 'Room type not found in the selected property.',
      });
    }

    return this.toResponse(roomType);
  }

  async create(context: TenantContext, dto: CreateRoomTypeDto): Promise<RoomTypeResponse> {
    const propertyId = requirePropertyContext(context);
    const code = dto.code.trim().toUpperCase();

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.roomType.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            name: dto.name.trim(),
            code,
            description: dto.description?.trim(),
            capacityAdults: dto.capacityAdults,
            capacityChildren: dto.capacityChildren,
            bedType: dto.bedType?.trim(),
          },
          select: ROOM_TYPE_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'room_type.created',
            entityType: 'RoomType',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: { code: created.code, name: created.name },
          },
          transaction,
        );

        return this.toResponse(created);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'room_type_code_conflict',
          message: 'A room type with this code already exists in the property.',
        });
      }
      throw error;
    }
  }

  async update(
    context: TenantContext,
    roomTypeId: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeResponse> {
    const propertyId = requirePropertyContext(context);
    const data: Prisma.RoomTypeUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.capacityAdults !== undefined) {
      data.capacityAdults = dto.capacityAdults;
    }
    if (dto.capacityChildren !== undefined) {
      data.capacityChildren = dto.capacityChildren;
    }
    if (dto.bedType !== undefined) {
      data.bedType = dto.bedType.trim();
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return this.get(context, roomTypeId);
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const before = await transaction.roomType.findFirst({
          where: {
            id: roomTypeId,
            organizationId: context.organizationId,
            propertyId,
          },
          select: ROOM_TYPE_SELECT,
        });

        if (before === null) {
          throw new NotFoundException({
            code: 'room_type_not_found',
            message: 'Room type not found in the selected property.',
          });
        }

        const updated = await transaction.roomType.update({
          where: { id: roomTypeId },
          data,
          select: ROOM_TYPE_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'room_type.updated',
            entityType: 'RoomType',
            entityId: roomTypeId,
            correlationId: context.correlationId,
            metadata: {
              before: {
                name: before.name,
                description: before.description,
                capacityAdults: before.capacityAdults,
                capacityChildren: before.capacityChildren,
                bedType: before.bedType,
                status: before.status,
              },
              after: {
                name: updated.name,
                description: updated.description,
                capacityAdults: updated.capacityAdults,
                capacityChildren: updated.capacityChildren,
                bedType: updated.bedType,
                status: updated.status,
              },
            },
          },
          transaction,
        );

        return this.toResponse(updated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'room_type_code_conflict',
          message: 'A room type with this code already exists in the property.',
        });
      }
      throw error;
    }
  }

  private toResponse(row: {
    id: string;
    organizationId: string;
    propertyId: string;
    name: string;
    code: string;
    description: string | null;
    capacityAdults: number;
    capacityChildren: number;
    bedType: string | null;
    status: RecordStatus;
    createdAt: Date;
    updatedAt: Date;
    _count: { rooms: number };
  }): RoomTypeResponse {
    const { _count, ...roomType } = row;
    return { ...roomType, roomCount: _count.rooms };
  }
}
