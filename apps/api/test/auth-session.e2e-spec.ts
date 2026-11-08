import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const ADMIN_EMAIL = 'admin@demo.nova.local';
const ADMIN_PASSWORD = 'NovaDemo!2026';

function setCookies(response: request.Response): string[] {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

describe('Local session authentication (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a signed CSRF token in a readable cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.get('/api/v1/auth/csrf').expect(200);

    expect(typeof response.body.csrfToken).toBe('string');
    const cookies = setCookies(response);
    expect(cookies.some((cookie) => cookie.startsWith('nova_csrf='))).toBe(true);
    expect(cookies.join(';')).not.toMatch(/nova_csrf=[^;]+;[^;]*HttpOnly/);
  });

  it('requires a matching CSRF cookie and header for login', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/v1/auth/csrf').expect(200);

    const missingHeader = await agent
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(403);
    expect(missingHeader.body.code).toBe('csrf_token_invalid');

    const forgedHeader = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', 'forged.token')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(403);
    expect(forgedHeader.body.code).toBe('csrf_token_invalid');
  });

  it('rejects invalid credentials without revealing whether the email exists', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);

    const response = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ email: 'nobody@demo.nova.local', password: 'wrong-password' })
      .expect(401);

    expect(response.body.code).toBe('invalid_credentials');
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('creates an HttpOnly session, authorizes tenant routes and revokes it on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);

    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    expect(login.body.user.email).toBe(ADMIN_EMAIL);
    expect(login.body.expiresAt).toEqual(expect.any(String));
    expect(login.body.csrfToken).toEqual(expect.any(String));

    const cookies = setCookies(login);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('nova_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Path=/');

    const session = await agent.get('/api/v1/auth/session').expect(200);
    expect(session.body.authentication).toBe('local-session');
    expect(session.body.user.email).toBe(ADMIN_EMAIL);

    const me = await agent.get('/api/v1/me').expect(200);
    expect(me.body.email).toBe(ADMIN_EMAIL);
    expect(me.body.memberships[0].role.key).toBe('ORG_ADMIN');

    const organizations = await agent.get('/api/v1/organizations').expect(200);
    expect(organizations.body.items.length).toBeGreaterThanOrEqual(1);

    await agent.post('/api/v1/auth/logout').set('x-csrf-token', login.body.csrfToken).expect(204);

    const afterLogout = await agent.get('/api/v1/me').expect(401);
    expect(afterLogout.body.code).toBe('unauthenticated');
  });

  it('rate-limits repeated login attempts', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const email = `rate-limit-${Date.now()}@demo.nova.local`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrf.body.csrfToken)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    const limited = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ email, password: 'wrong-password' })
      .expect(429);

    expect(limited.body.code).toBe('rate_limited');
  });
});
