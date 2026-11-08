import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { readCookie } from '../common/http/cookies';
import { CSRF_HEADER, CSRF_COOKIE_NAME } from '../common/http/request-context';

/**
 * Signed double-submit CSRF tokens.
 *
 * The token is `nonce.signature`, where signature = HMAC-SHA256(secret, nonce).
 * The browser stores it in a non-HttpOnly cookie and echoes it in a header.
 * An attacker cannot mint a valid signature, and a cross-site form cannot read
 * the cookie to echo it.
 */
@Injectable()
export class CsrfService {
  readonly cookieName: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.cookieName = config.get<string>('CSRF_COOKIE_NAME', CSRF_COOKIE_NAME);
    this.secret = config.get<string>('CSRF_SECRET') ?? randomBytes(32).toString('hex');
  }

  issue(): string {
    const nonce = randomBytes(18).toString('base64url');
    return `${nonce}.${this.sign(nonce)}`;
  }

  verify(token: string | undefined | null): boolean {
    if (token === undefined || token === null) {
      return false;
    }

    const separator = token.indexOf('.');
    if (separator < 1 || separator !== token.lastIndexOf('.')) {
      return false;
    }

    const nonce = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (nonce.length < 16 || nonce.length > 128 || signature.length === 0) {
      return false;
    }

    const expected = this.sign(nonce);
    return this.safeEqual(signature, expected);
  }

  assertRequest(request: Request): void {
    const cookieToken = readCookie(request, this.cookieName);
    const headerToken = request.header(CSRF_HEADER);

    if (
      cookieToken === undefined ||
      headerToken === undefined ||
      !this.safeEqual(cookieToken, headerToken) ||
      !this.verify(headerToken)
    ) {
      throw new ForbiddenException({
        code: 'csrf_token_invalid',
        message: 'A valid CSRF token is required for this operation.',
      });
    }
  }

  private sign(nonce: string): string {
    return createHmac('sha256', this.secret).update(nonce, 'utf8').digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
