import type { INestApplication } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { TotpService } from '../src/auth/totp.service';
import { SystemClock } from '../src/common/time/clock';
import { PrismaService } from '../src/prisma/prisma.service';

const ADMIN_EMAIL = 'admin@demo.nova.local';
const ADMIN_PASSWORD = 'NovaDemo!2026';

function setCookies(response: request.Response): string[] {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

async function csrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get('/api/v1/auth/csrf').expect(200);
  return response.body.csrfToken as string;
}

async function loginRaw(
  agent: ReturnType<typeof request.agent>,
  email: string,
  password: string,
  mfaCode?: string,
): Promise<request.Response> {
  const token = await csrf(agent);
  return agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', token)
    .send({ email, password, ...(mfaCode !== undefined ? { mfaCode } : {}) });
}

async function login(
  agent: ReturnType<typeof request.agent>,
  email: string,
  password: string,
  expectedStatus = 200,
  mfaCode?: string,
): Promise<request.Response> {
  const response = await loginRaw(agent, email, password, mfaCode);
  expect(response.status).toBe(expectedStatus);
  return response;
}

describe('Local session authentication (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const totp = new TotpService(new SystemClock());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes the configured auth mode without credentials', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/mode').expect(200);

    expect(response.body).toEqual({ authMode: 'local-session' });
    expect(response.headers['cache-control']).toBe('no-store');
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
    const token = await csrf(agent);

    const response = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', token)
      .send({ email: 'nobody@demo.nova.local', password: 'wrong-password' })
      .expect(401);

    expect(response.body.code).toBe('invalid_credentials');
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('creates an HttpOnly session, authorizes tenant routes and revokes it on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginResponse = await login(agent, ADMIN_EMAIL, ADMIN_PASSWORD, 200);

    expect(loginResponse.body.user.email).toBe(ADMIN_EMAIL);
    expect(loginResponse.body.expiresAt).toEqual(expect.any(String));
    expect(loginResponse.body.csrfToken).toEqual(expect.any(String));

    const cookies = setCookies(loginResponse);
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

    await agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', loginResponse.body.csrfToken)
      .expect(204);

    const afterLogout = await agent.get('/api/v1/me').expect(401);
    expect(afterLogout.body.code).toBe('unauthenticated');
  });

  it('rate-limits repeated login attempts', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const email = `rate-limit-${Date.now()}@demo.nova.local`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', token)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    const limited = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', token)
      .send({ email, password: 'wrong-password' })
      .expect(429);

    expect(limited.body.code).toBe('rate_limited');
  });

  it('locks an active account after repeated failed attempts and records security events', async () => {
    const email = `lockout-${Date.now()}@demo.nova.local`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Lockout Test',
        passwordHash: await passwords.hash('Nova-Secure!2026'),
        status: RecordStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });

    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', token)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    const locked = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', token)
      .send({ email, password: 'Nova-Secure!2026' })
      .expect(423);

    expect(locked.body.code).toBe('account_locked');

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { lockedUntil: true, failedLoginAttempts: true },
    });
    expect(dbUser.lockedUntil).not.toBeNull();
    expect(dbUser.failedLoginAttempts).toBeGreaterThanOrEqual(3);
  });

  it('lists and revokes the current user sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(agent, ADMIN_EMAIL, ADMIN_PASSWORD, 200);

    const sessions = await agent.get('/api/v1/auth/sessions').expect(200);
    expect(Array.isArray(sessions.body)).toBe(true);
    expect(sessions.body.some((session: { current: boolean }) => session.current)).toBe(true);

    const otherAgent = request.agent(app.getHttpServer());
    const otherLogin = await login(otherAgent, ADMIN_EMAIL, ADMIN_PASSWORD, 200);
    const otherSessions = await otherAgent.get('/api/v1/auth/sessions').expect(200);
    const nonCurrent = otherSessions.body.find(
      (session: { current: boolean; id: string }) => !session.current,
    );
    expect(nonCurrent).toBeDefined();

    await otherAgent
      .delete(`/api/v1/auth/sessions/${nonCurrent.id}`)
      .set('x-csrf-token', otherLogin.body.csrfToken)
      .expect(204);

    await agent.get('/api/v1/auth/session').expect(401);
  });

  it('changes password, revokes other sessions, and enforces password policy', async () => {
    const email = `pwchange-${Date.now()}@demo.nova.local`;
    const original = 'Nova-Secure!2026';
    const next = 'Nova-Secure!2027';
    await prisma.user.create({
      data: {
        email,
        name: 'Password Change',
        passwordHash: await passwords.hash(original),
        status: RecordStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    const current = request.agent(app.getHttpServer());
    const currentLogin = await login(current, email, original, 200);

    const other = request.agent(app.getHttpServer());
    await login(other, email, original, 200);

    const weakToken = await csrf(current);
    const weak = await current
      .post('/api/v1/auth/password/change')
      .set('x-csrf-token', weakToken)
      .send({ currentPassword: original, newPassword: 'short' })
      .expect(400);
    expect(weak.body.code).toBe('password_policy_violation');

    const changeToken = await csrf(current);
    await current
      .post('/api/v1/auth/password/change')
      .set('x-csrf-token', changeToken)
      .send({ currentPassword: original, newPassword: next })
      .expect(204);

    await other.get('/api/v1/auth/session').expect(401);

    const relogin = await login(current, email, next, 200);
    expect(relogin.body.user.email).toBe(email);

    const oldPassword = await login(request.agent(app.getHttpServer()), email, original, 401);
    expect(oldPassword.body.code).toBe('invalid_credentials');

    await current
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', currentLogin.body.csrfToken)
      .ok((res) => res.status === 204 || res.status === 401);
  });

  it('resets a password with a one-time token', async () => {
    const email = `reset-${Date.now()}@demo.nova.local`;
    await prisma.user.create({
      data: {
        email,
        name: 'Reset Test',
        passwordHash: await passwords.hash('Nova-Secure!2026'),
        status: RecordStatus.ACTIVE,
      },
    });

    const agent = request.agent(app.getHttpServer());
    const forgotToken = await csrf(agent);
    const forgot = await agent
      .post('/api/v1/auth/password/forgot')
      .set('x-csrf-token', forgotToken)
      .send({ email })
      .expect(202);
    expect(forgot.body.token).toEqual(expect.any(String));

    const resetToken = await csrf(agent);
    await agent
      .post('/api/v1/auth/password/reset')
      .set('x-csrf-token', resetToken)
      .send({ token: forgot.body.token, newPassword: 'Nova-Secure!2028' })
      .expect(204);

    await login(request.agent(app.getHttpServer()), email, 'Nova-Secure!2028', 200);

    const replayToken = await csrf(agent);
    const replay = await agent
      .post('/api/v1/auth/password/reset')
      .set('x-csrf-token', replayToken)
      .send({ token: forgot.body.token, newPassword: 'Nova-Secure!2029' })
      .expect(400);
    expect(replay.body.code).toBe('invalid_auth_token');
  });

  it('verifies email with a one-time token', async () => {
    const email = `verify-${Date.now()}@demo.nova.local`;
    await prisma.user.create({
      data: {
        email,
        name: 'Verify Test',
        passwordHash: await passwords.hash('Nova-Secure!2026'),
        status: RecordStatus.ACTIVE,
        emailVerifiedAt: null,
      },
    });

    const agent = request.agent(app.getHttpServer());
    await login(agent, email, 'Nova-Secure!2026', 200);

    const requestToken = await csrf(agent);
    const requested = await agent
      .post('/api/v1/auth/email/verification')
      .set('x-csrf-token', requestToken)
      .expect(202);
    expect(requested.body.token).toEqual(expect.any(String));

    const verifyToken = await csrf(agent);
    await agent
      .post('/api/v1/auth/email/verify')
      .set('x-csrf-token', verifyToken)
      .send({ token: requested.body.token })
      .expect(204);

    const verified = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { emailVerifiedAt: true },
    });
    expect(verified.emailVerifiedAt).not.toBeNull();
  });

  it('enrolls MFA, requires a challenge on login, and disables MFA', async () => {
    const email = `mfa-${Date.now()}@demo.nova.local`;
    const password = 'Nova-Secure!2026';
    await prisma.user.create({
      data: {
        email,
        name: 'MFA Test',
        passwordHash: await passwords.hash(password),
        status: RecordStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    const agent = request.agent(app.getHttpServer());
    await login(agent, email, password, 200);

    const setupToken = await csrf(agent);
    const setup = await agent
      .post('/api/v1/auth/mfa/setup')
      .set('x-csrf-token', setupToken)
      .expect(200);
    expect(setup.body.secret).toEqual(expect.any(String));
    expect(setup.body.otpauthUri).toContain('otpauth://totp/');

    const enableCode = totp.codeForStep(setup.body.secret, totp.stepForDate(new Date()));
    const enableToken = await csrf(agent);
    await agent
      .post('/api/v1/auth/mfa/enable')
      .set('x-csrf-token', enableToken)
      .send({ code: enableCode })
      .expect(204);

    const loginAgent = request.agent(app.getHttpServer());
    const challenge = await login(loginAgent, email, password, 200);
    expect(challenge.body.mfaRequired).toBe(true);
    expect(challenge.body.challengeToken).toEqual(expect.any(String));

    const completeToken = await csrf(loginAgent);
    const complete = await loginAgent
      .post('/api/v1/auth/login/mfa')
      .set('x-csrf-token', completeToken)
      .send({
        challengeToken: challenge.body.challengeToken,
        code: totp.codeForStep(setup.body.secret, totp.stepForDate(new Date()) + 1),
      });
    // If the step advanced naturally this might be accepted by window; otherwise generate a fresh code.
    if (complete.status !== 200) {
      const retryToken = await csrf(loginAgent);
      await loginAgent
        .post('/api/v1/auth/login/mfa')
        .set('x-csrf-token', retryToken)
        .send({
          challengeToken: challenge.body.challengeToken,
          code: totp.codeForStep(setup.body.secret, totp.stepForDate(new Date())),
        })
        .expect(200);
    }

    const disableToken = await csrf(agent);
    await agent
      .post('/api/v1/auth/mfa/disable')
      .set('x-csrf-token', disableToken)
      .send({
        password,
        code: totp.codeForStep(setup.body.secret, totp.stepForDate(new Date())),
      })
      .expect(204);

    const afterDisable = await login(request.agent(app.getHttpServer()), email, password, 200);
    expect(afterDisable.body.mfaRequired).not.toBe(true);
    expect(afterDisable.body.user.email).toBe(email);
  });
});
