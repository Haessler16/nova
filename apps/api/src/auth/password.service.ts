import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

/**
 * Local credential hashing for the transitional authentication phase.
 *
 * The format is intentionally self-describing so cost parameters can be raised
 * later without invalidating existing hashes:
 *   scrypt$N$r$p$base64url(salt)$base64url(hash)
 *
 * scrypt is built into Node; avoiding a native dependency keeps deployment and
 * CI deterministic. Before production, validate memory/CPU cost for the chosen
 * deployment size and rotate to stronger parameters if needed.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    if (password.length === 0) {
      throw new Error('Password must not be empty.');
    }

    const salt = randomBytes(SALT_LENGTH);
    const derived = await this.derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    return [
      'scrypt',
      SCRYPT_N,
      SCRYPT_R,
      SCRYPT_P,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encoded: string | null | undefined): Promise<boolean> {
    if (encoded === null || encoded === undefined || encoded.length === 0) {
      return false;
    }

    const parts = encoded.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }
    if (n < 1024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) {
      return false;
    }

    let salt: Buffer;
    let expected: Buffer;
    try {
      salt = Buffer.from(parts[4] ?? '', 'base64url');
      expected = Buffer.from(parts[5] ?? '', 'base64url');
    } catch {
      return false;
    }

    if (salt.length < 8 || expected.length < 16) {
      return false;
    }

    try {
      const actual = await this.derive(password, salt, n, r, p);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  private derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        { N: n, r, p, maxmem: MAX_MEMORY },
        (error, derivedKey) => {
          if (error !== null) {
            reject(error);
            return;
          }
          resolve(derivedKey);
        },
      );
    });
  }
}
