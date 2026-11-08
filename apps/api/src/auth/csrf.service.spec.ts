import { CsrfService } from './csrf.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

function buildService(): CsrfService {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'CSRF_SECRET' ? 's'.repeat(64) : fallback,
    ),
  } as unknown as ConfigService;
  return new CsrfService(config);
}

function buildRequest(cookie: string | undefined, header: string | undefined): Request {
  return {
    headers: cookie !== undefined ? { cookie: `nova_csrf=${encodeURIComponent(cookie)}` } : {},
    header: jest.fn((name: string) => (name.toLowerCase() === 'x-csrf-token' ? header : undefined)),
  } as unknown as Request;
}

describe('CsrfService', () => {
  it('issues signed tokens that verify', () => {
    const service = buildService();
    const token = service.issue();

    expect(service.verify(token)).toBe(true);
  });

  it('rejects tampered or missing tokens', () => {
    const service = buildService();
    const token = service.issue();
    const tampered = `${token.slice(0, -1)}A`;

    expect(service.verify(tampered)).toBe(false);
    expect(service.verify(undefined)).toBe(false);
    expect(service.verify('not-a-token')).toBe(false);
  });

  it('requires cookie and header to match', () => {
    const service = buildService();
    const token = service.issue();

    expect(() => service.assertRequest(buildRequest(token, token))).not.toThrow();
    expect(() => service.assertRequest(buildRequest(token, service.issue()))).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertRequest(buildRequest(undefined, token))).toThrow(ForbiddenException);
  });
});
