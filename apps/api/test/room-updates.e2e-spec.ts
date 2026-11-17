import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const PROPERTY_CENTRO = '00000000-0000-4000-8000-000000000002';
const PROPERTY_PRAIA = '00000000-0000-4000-8000-000000000003';
const ADMIN = '00000000-0000-4000-8000-000000000011';

function headers(userId: string, organizationId: string, propertyId: string) {
  return {
    'x-dev-user-id': userId,
    'x-organization-id': organizationId,
    'x-property-id': propertyId,
  };
}

/**
 * Reads SSE frames until `predicate` matches or the timeout expires. The
 * endpoint is a stream, so this drives the reader directly instead of relying
 * on supertest, which waits for a complete response.
 */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (buffer: string) => boolean,
  buffer = '',
  timeoutMs = 4000,
): Promise<{ buffer: string; matched: boolean }> {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let current = buffer;

  while (Date.now() < deadline) {
    const next = await Promise.race([
      reader.read(),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 500)),
    ]);
    if (next === 'timeout') {
      continue;
    }
    if (next.done) {
      return { buffer: current, matched: predicate(current) };
    }
    current += decoder.decode(next.value, { stream: true });
    if (predicate(current)) {
      return { buffer: current, matched: true };
    }
  }
  return { buffer: current, matched: predicate(current) };
}

describe('Room rack updates (SSE, E2E)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const suffix = Date.now().toString(36).toUpperCase();
  let roomTypeId: string;
  let roomId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('The test server did not expose a TCP port.');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    const roomType = await request(app.getHttpServer())
      .post('/api/v1/inventory/room-types')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({ name: 'SSE Studio', code: `S${suffix.slice(-8)}`, capacityAdults: 2 })
      .expect(201);
    roomTypeId = roomType.body.id;

    const room = await request(app.getHttpServer())
      .post('/api/v1/inventory/rooms')
      .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
      .send({ number: `S${suffix.slice(-8)}`, roomTypeId })
      .expect(201);
    roomId = room.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams a ready frame and forwards a room change to the tenant', async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/v1/inventory/rooms/updates`, {
      headers: { ...headers(ADMIN, ORG_A, PROPERTY_CENTRO), Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();

    try {
      const ready = await readUntil(reader, (buffer) => buffer.includes('"type":"ready"'));
      expect(ready.matched).toBe(true);

      await request(app.getHttpServer())
        .patch(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ attributes: ['sse'] })
        .expect(200);

      const update = await readUntil(
        reader,
        (buffer) => buffer.includes('"type":"room.updated"'),
        ready.buffer,
      );
      expect(update.matched).toBe(true);
      expect(update.buffer).toContain(roomId);
    } finally {
      controller.abort();
      await reader.cancel().catch(() => undefined);
    }
  });

  it('delivers the same event to two concurrent streams of one tenant', async () => {
    const first = new AbortController();
    const second = new AbortController();
    const requestInit = (controller: AbortController): RequestInit => ({
      headers: { ...headers(ADMIN, ORG_A, PROPERTY_CENTRO), Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    const firstResponse = await fetch(
      `${baseUrl}/api/v1/inventory/rooms/updates`,
      requestInit(first),
    );
    const firstReader = firstResponse.body!.getReader();
    const firstReady = await readUntil(firstReader, (buffer) => buffer.includes('"type":"ready"'));
    expect(firstReady.matched).toBe(true);

    const secondResponse = await fetch(
      `${baseUrl}/api/v1/inventory/rooms/updates`,
      requestInit(second),
    );
    const secondReader = secondResponse.body!.getReader();
    const secondReady = await readUntil(
      secondReader,
      (buffer) => buffer.includes('"type":"ready"'),
    );
    expect(secondReady.matched).toBe(true);

    try {
      await request(app.getHttpServer())
        .patch(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ attributes: ['sse-broadcast'] })
        .expect(200);

      const [firstUpdate, secondUpdate] = await Promise.all([
        readUntil(
          firstReader,
          (buffer) => buffer.includes('"type":"room.updated"'),
          firstReady.buffer,
        ),
        readUntil(
          secondReader,
          (buffer) => buffer.includes('"type":"room.updated"'),
          secondReady.buffer,
        ),
      ]);

      expect(firstUpdate.matched).toBe(true);
      expect(secondUpdate.matched).toBe(true);

      const firstId = /"id":(\d+)/.exec(firstUpdate.buffer)?.[1];
      const secondId = /"id":(\d+)/.exec(secondUpdate.buffer)?.[1];
      expect(firstId).toBeDefined();
      expect(secondId).toBe(firstId);
      expect(firstUpdate.buffer).toContain(roomId);
      expect(secondUpdate.buffer).toContain(roomId);
    } finally {
      first.abort();
      second.abort();
      await firstReader.cancel().catch(() => undefined);
      await secondReader.cancel().catch(() => undefined);
    }
  });

  it('does not leak another property events into this stream', async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/v1/inventory/rooms/updates`, {
      headers: {
        ...headers(ADMIN, ORG_A, PROPERTY_PRAIA),
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();

    try {
      const ready = await readUntil(reader, (buffer) => buffer.includes('"type":"ready"'));
      expect(ready.matched).toBe(true);

      await request(app.getHttpServer())
        .patch(`/api/v1/inventory/rooms/${roomId}`)
        .set(headers(ADMIN, ORG_A, PROPERTY_CENTRO))
        .send({ attributes: ['sse-isolation'] })
        .expect(200);

      const after = await readUntil(
        reader,
        (buffer) => buffer.includes('"type":"room.updated"'),
        ready.buffer,
        1500,
      );
      expect(after.matched).toBe(false);
    } finally {
      controller.abort();
      await reader.cancel().catch(() => undefined);
    }
  });

  it('requires an authenticated session', async () => {
    const response = await fetch(`${baseUrl}/api/v1/inventory/rooms/updates`, {
      headers: { ...headers(ADMIN, ORG_A, PROPERTY_CENTRO), Accept: 'text/event-stream' },
    });
    expect(response.status).toBe(200);
    await response.body?.cancel();

    const anonymous = await fetch(`${baseUrl}/api/v1/inventory/rooms/updates`, {
      headers: { 'x-organization-id': ORG_A, 'x-property-id': PROPERTY_CENTRO },
    });
    expect(anonymous.status).toBe(401);
    await anonymous.body?.cancel();
  });
});