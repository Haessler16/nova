import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../common/time/clock';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const CIPHER_VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface MfaChallenge {
  token: string;
  expiresAt: Date;
}

interface ChallengePayload {
  sub: string;
  exp: number;
}

/**
 * Encrypts TOTP shared secrets at rest and signs short-lived MFA challenge
 * tokens. Both use separate derivations of MFA_ENCRYPTION_KEY. If the key is
 * absent MFA enrollment returns 503 instead of storing plaintext secrets.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly keyMaterial: string | null;
  private readonly challengeTtlSeconds: number;

  constructor(
    config: ConfigService,
    private readonly clock: Clock,
  ) {
    this.keyMaterial = config.get<string>('MFA_ENCRYPTION_KEY') ?? null;
    this.challengeTtlSeconds = config.get<number>('MFA_CHALLENGE_TTL_SECONDS', 300);
  }

  isConfigured(): boolean {
    return this.keyMaterial !== null && this.keyMaterial.length >= 32;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'mfa_not_configured',
        message: 'MFA is not configured for this environment.',
      });
    }
  }

  encryptSecret(secret: string): string {
    this.assertConfigured();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      CIPHER_VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decryptSecret(encrypted: string): string {
    this.assertConfigured();
    const parts = encrypted.split('.');
    if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
      throw new Error('Unsupported MFA secret format.');
    }

    const iv = Buffer.from(parts[1] ?? '', 'base64url');
    const tag = Buffer.from(parts[2] ?? '', 'base64url');
    const ciphertext = Buffer.from(parts[3] ?? '', 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('Invalid MFA secret payload.');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  issueChallenge(userId: string): MfaChallenge {
    this.assertConfigured();
    const expiresAt = new Date(this.clock.now().getTime() + this.challengeTtlSeconds * 1000);
    const payload: ChallengePayload = { sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return { token: `${encoded}.${this.sign(encoded)}`, expiresAt };
  }

  verifyChallenge(token: string): string | null {
    if (!this.isConfigured() || token.length === 0 || token.length > 2048) {
      return null;
    }

    const separator = token.indexOf('.');
    if (separator < 1 || separator !== token.lastIndexOf('.')) {
      return null;
    }

    const encoded = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!this.safeEqual(signature, this.sign(encoded))) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (parsed === null || typeof parsed !== 'object') {
        return null;
      }
      const payload = parsed as Partial<ChallengePayload>;
      if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
        return null;
      }
      if (payload.exp * 1000 <= this.clock.now().getTime()) {
        return null;
      }
      return payload.sub;
    } catch (error) {
      this.logger.debug(
        `Invalid MFA challenge payload: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(`nova-mfa-encryption:${this.keyMaterial ?? ''}`, 'utf8')
      .digest()
      .subarray(0, KEY_BYTES);
  }

  private challengeKey(): Buffer {
    return createHash('sha256')
      .update(`nova-mfa-challenge:${this.keyMaterial ?? ''}`, 'utf8')
      .digest();
  }

  private sign(value: string): string {
    return createHmac('sha256', this.challengeKey()).update(value, 'utf8').digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
