import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CreatedSession } from './session.service';

export const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$_LHEVNMERXnKSJ59B37E4g$vxl8wF1ZxOrTKptLz1M6f13ECXXX6h0xLGhRUylUwjjFFrZxMHC9tob6nBE0NXPkHmSeT_GCq-6-JbOnRZ2VnQ';

export const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  status: true,
  mfaEnabled: true,
  mfaSecret: true,
  mfaLastUsedStep: true,
  lockedUntil: true,
  failedLoginAttempts: true,
} as const;

export interface AuthRequestMetadata {
  ip: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export type LoginResult =
  | {
      kind: 'session';
      user: AuthenticatedUser;
      session: CreatedSession;
    }
  | {
      kind: 'mfa_challenge';
      challengeToken: string;
      expiresAt: Date;
    };

export interface IssuedTokenResponse {
  expiresAt: string;
  /** Only populated when AUTH_TOKEN_DELIVERY=response outside production. */
  token?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex');
}

export function userAgent(metadata: AuthRequestMetadata): string | undefined {
  const value = metadata.userAgent?.trim();
  return value === undefined || value.length === 0 ? undefined : value.slice(0, 255);
}

export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'invalid_credentials',
    message: 'Invalid email or password.',
  });
}

export function invalidMfaCode(message = 'The authentication code is invalid.'): UnauthorizedException {
  return new UnauthorizedException({
    code: 'invalid_mfa_code',
    message,
  });
}

export function invalidToken(): BadRequestException {
  return new BadRequestException({
    code: 'invalid_auth_token',
    message: 'The token is invalid, expired or already used.',
  });
}

export function accountLocked(lockedUntil: Date, now: Date): HttpException {
  throw new HttpException(
    {
      code: 'account_locked',
      message: 'The account is temporarily locked after repeated failed sign-in attempts.',
      details: {
        retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)),
      },
    },
    423,
  );
}
