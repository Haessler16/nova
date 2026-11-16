import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { requirePropertyContext } from './room-state.service';

export interface RoomAssignmentLease {
  leaseId: string;
  roomId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  reservationId: string | null;
  createdAt: string;
  expiresAt: string;
}

const LEASE_KEY_PREFIX = 'nova:room-lease:v1';
const MUTATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ok, value = pcall(cjson.decode, raw)
if not ok or value.leaseId ~= ARGV[1] then return 0 end
if ARGV[2] == 'renew' then
  redis.call('SET', KEYS[1], ARGV[4], 'PX', tonumber(ARGV[3]))
  return 1
end
redis.call('DEL', KEYS[1])
return 1
`;

/**
 * Ephemeral UX coordination for room selection. Redis owns only the TTL; the
 * reservation/stay constraints remain the authority for the final assignment.
 * A missing/expired key never blocks a confirmed operation.
 */
@Injectable()
export class RoomAssignmentLeasesService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    const configured = Number(config.get<string>('ROOM_ASSIGNMENT_LEASE_TTL_SECONDS', '120'));
    const seconds = Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 600) : 120;
    this.ttlMs = Math.round(seconds * 1000);
  }

  async getMany(context: TenantContext, roomIds: string[]): Promise<Map<string, RoomAssignmentLease>> {
    const propertyId = requirePropertyContext(context);
    if (roomIds.length === 0) {
      return new Map();
    }

    const raw = await this.redis.getMany(roomIds.map((roomId) => this.key(context, propertyId, roomId)));
    const leases = new Map<string, RoomAssignmentLease>();
    raw.forEach((value, index) => {
      const lease = this.parse(value);
      const roomId = roomIds[index];
      if (lease !== null && roomId !== undefined) {
        leases.set(roomId, lease);
      }
    });
    return leases;
  }

  async acquire(
    context: TenantContext,
    roomId: string,
    reservationId?: string,
  ): Promise<RoomAssignmentLease> {
    const propertyId = requirePropertyContext(context);
    await this.assertRoom(context.organizationId, propertyId, roomId);
    if (reservationId !== undefined) {
      await this.assertReservation(context.organizationId, propertyId, reservationId);
    }

    const key = this.key(context, propertyId, roomId);
    const existing = this.parse(await this.redis.get(key));
    if (existing !== null) {
      if (existing.ownerUserId !== context.actor.id) {
        throw this.held(existing);
      }
      return this.renewLease(key, existing, reservationId);
    }

    const now = new Date();
    const lease: RoomAssignmentLease = {
      leaseId: randomUUID(),
      roomId,
      ownerUserId: context.actor.id,
      ownerDisplayName: context.actor.name,
      reservationId: reservationId ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };

    let created: boolean;
    try {
      created = await this.redis.setIfAbsent(key, JSON.stringify(lease), this.ttlMs);
    } catch {
      throw new ServiceUnavailableException({
        code: 'room_lease_unavailable',
        message: 'Room selection coordination is temporarily unavailable.',
      });
    }

    if (!created) {
      const winner = this.parse(await this.redis.get(key));
      if (winner !== null) {
        throw this.held(winner);
      }
      throw new ConflictException({
        code: 'room_lease_conflict',
        message: 'Another session acquired this room selection. Refresh the room list.',
      });
    }

    return lease;
  }

  async renew(
    context: TenantContext,
    roomId: string,
    leaseId: string,
  ): Promise<RoomAssignmentLease> {
    const propertyId = requirePropertyContext(context);
    const key = this.key(context, propertyId, roomId);
    const existing = this.parse(await this.redis.get(key));
    if (existing === null || existing.leaseId !== leaseId) {
      throw new NotFoundException({
        code: 'room_lease_not_found',
        message: 'The room selection lease no longer exists.',
      });
    }
    if (existing.ownerUserId !== context.actor.id) {
      throw new ForbiddenException({
        code: 'room_lease_owner_required',
        message: 'Only the session that acquired the lease can renew it.',
      });
    }
    return this.renewLease(key, existing, existing.reservationId ?? undefined);
  }

  async release(context: TenantContext, roomId: string, leaseId: string): Promise<void> {
    const propertyId = requirePropertyContext(context);
    const key = this.key(context, propertyId, roomId);
    const existing = this.parse(await this.redis.get(key));
    if (existing === null) {
      return;
    }
    if (existing.ownerUserId !== context.actor.id) {
      throw new ForbiddenException({
        code: 'room_lease_owner_required',
        message: 'Only the session that acquired the lease can release it.',
      });
    }

    try {
      const changed = await this.redis.eval(
        MUTATE_SCRIPT,
        [key],
        [leaseId, 'release', String(this.ttlMs), ''],
      );
      if (changed !== 1) {
        return;
      }
    } catch {
      // Releasing is best effort; the TTL still removes an orphan.
    }
  }

  private async renewLease(
    key: string,
    existing: RoomAssignmentLease,
    reservationId: string | undefined,
  ): Promise<RoomAssignmentLease> {
    const now = new Date();
    const renewed: RoomAssignmentLease = {
      ...existing,
      reservationId: reservationId ?? existing.reservationId,
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };

    try {
      const changed = await this.redis.eval(
        MUTATE_SCRIPT,
        [key],
        [existing.leaseId, 'renew', String(this.ttlMs), JSON.stringify(renewed)],
      );
      if (changed !== 1) {
        throw new ConflictException({
          code: 'room_lease_changed',
          message: 'The room selection lease changed in another session. Refresh the room list.',
        });
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ServiceUnavailableException({
        code: 'room_lease_unavailable',
        message: 'Room selection coordination is temporarily unavailable.',
      });
    }

    return renewed;
  }

  private held(lease: RoomAssignmentLease): ConflictException {
    return new ConflictException({
      code: 'room_lease_held',
      message: `The room is being selected by ${lease.ownerDisplayName}.`,
      details: {
        ownerDisplayName: lease.ownerDisplayName,
        expiresAt: lease.expiresAt,
      },
    });
  }

  private parse(value: string | null): RoomAssignmentLease | null {
    if (value === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as Partial<RoomAssignmentLease>;
      if (
        typeof parsed.leaseId !== 'string' ||
        typeof parsed.roomId !== 'string' ||
        typeof parsed.ownerUserId !== 'string' ||
        typeof parsed.ownerDisplayName !== 'string' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.expiresAt !== 'string'
      ) {
        return null;
      }
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        return null;
      }
      return {
        leaseId: parsed.leaseId,
        roomId: parsed.roomId,
        ownerUserId: parsed.ownerUserId,
        ownerDisplayName: parsed.ownerDisplayName,
        reservationId:
          typeof parsed.reservationId === 'string' ? parsed.reservationId : null,
        createdAt: parsed.createdAt,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  private key(context: TenantContext, propertyId: string, roomId: string): string {
    return `${LEASE_KEY_PREFIX}:${context.organizationId}:${propertyId}:${roomId}`;
  }

  private async assertRoom(
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId, propertyId },
      select: { status: true },
    });
    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }
    if (room.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'room_not_active',
        message: 'Only an active room can be selected.',
      });
    }
  }

  private async assertReservation(
    organizationId: string,
    propertyId: string,
    reservationId: string,
  ): Promise<void> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId,
        propertyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      select: { id: true },
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found or not available for selection in this property.',
      });
    }
  }
}
