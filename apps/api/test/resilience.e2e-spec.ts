import type { INestApplication } from '@nestjs/common';
import { RoomBlockStatus, RoomBlockType, RoomOperationalState } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RoomBlockExpiryScheduler } from '../src/inventory/room-block-expiry.scheduler';
import { PrismaService } from '../src/prisma/prisma.service';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000011';
const ROOM_CENTRO_101 = '00000000-0000-4000-8000-000000000051';

function headers() {
  return {
    'x-dev-user-id': ADMIN,
    'x-organization-id': ORG_A,
    'x-property-id': PROPERTY_CENTRO,
  };
}

describe('Scheduler and resilience (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: RoomBlockExpiryScheduler;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    scheduler = app.get(RoomBlockExpiryScheduler);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reconciles expired active room blocks idempotently', async () => {
    const now = Date.now();
    const block = await prisma.roomBlock.create({
      data: {
        organizationId: ORG_A,
        propertyId: PROPERTY_CENTRO,
        roomId: ROOM_CENTRO_101,
        type: RoomBlockType.OUT_OF_ORDER,
        status: RoomBlockStatus.ACTIVE,
        reason: 'Synthetic expired scheduler test',
        startsAt: new Date(now - 2 * 60 * 60 * 1000),
        endsAt: new Date(now - 60 * 60 * 1000),
        createdByUserId: ADMIN,
      },
      select: { id: true },
    });

    await prisma.room.update({
      where: { id: ROOM_CENTRO_101 },
      data: { operationalState: RoomOperationalState.OUT_OF_ORDER },
    });

    const first = await scheduler.runOnce('e2e-test');
    expect(first.skipped).toBe(false);
    expect(first.expiredBlocks).toBeGreaterThanOrEqual(1);

    const afterFirst = await prisma.roomBlock.findUniqueOrThrow({
      where: { id: block.id },
      select: { status: true, releasedAt: true, releaseReason: true },
    });
    expect(afterFirst.status).toBe('EXPIRED');
    expect(afterFirst.releasedAt).not.toBeNull();

    const room = await prisma.room.findUniqueOrThrow({
      where: { id: ROOM_CENTRO_101 },
      select: { operationalState: true },
    });
    expect(room.operationalState).toBe('AVAILABLE');

    const second = await scheduler.runOnce('e2e-test-repeat');
    expect(second.skipped).toBe(false);
    expect(second.expiredBlocks).toBe(0);

    const operationalHistory = await prisma.roomStatusHistory.count({
      where: {
        roomId: ROOM_CENTRO_101,
        category: 'OPERATIONAL',
        toState: 'AVAILABLE',
        reason: 'Room block interval reconciliation.',
      },
    });
    expect(operationalHistory).toBeGreaterThanOrEqual(1);
  });

  it('keeps SecurityEvent append-only at the database layer', async () => {
    const event = await prisma.securityEvent.create({
      data: {
        type: 'test.append_only_probe',
        severity: 'INFO',
        organizationId: ORG_A,
        userId: ADMIN,
        actorUserId: ADMIN,
      },
      select: { id: true },
    });

    await expect(
      prisma.securityEvent.update({
        where: { id: event.id },
        data: { severity: 'CRITICAL' },
      }),
    ).rejects.toThrow(/append-only/);

    await expect(prisma.securityEvent.delete({ where: { id: event.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('exposes readiness details and metrics', async () => {
    const ready = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(ready.body.status).toBe('ok');
    expect(ready.body.checks).toEqual({ database: 'up', redis: 'up' });

    await request(app.getHttpServer()).get('/api/v1/inventory/rooms').set(headers()).expect(200);

    const metrics = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(metrics.text).toContain('nova_http_requests_total');
  });
});
