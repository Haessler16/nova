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
    const parsed = parseEncodedPassword(encoded);
    if (parsed === null) {
      return false;
    }

    try {
      const actual = await this.derive(password, parsed.salt, parsed.n, parsed.r, parsed.p);
      return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
    } catch {
      return false;
    }
  }

  private derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
    // Scrypt parameters come from the stored hash; bound them so a corrupted or
    // hostile record cannot turn verification into an unbounded CPU or memory hit.
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

interface ParsedEncodedPassword {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
}

/**
 * Decodes a stored `scrypt$N$r$p$salt$hash` value, rejecting anything that is
 * not a well-formed hash within the accepted parameter bounds.
 */
function parseEncodedPassword(encoded: string | null | undefined): ParsedEncodedPassword | null {
  const parts = splitEncodedPassword(encoded);
  if (parts === null) {
    return null;
  }

  const parameters = parseScryptParameters(parts);
  const buffers = decodePasswordBuffers(parts);
  if (parameters === null || buffers === null) {
    return null;
  }

  return { ...parameters, ...buffers };
}

function splitEncodedPassword(encoded: string | null | undefined): string[] | null {
  if (encoded === null || encoded === undefined || encoded.length === 0) {
    return null;
  }
  const parts = encoded.split('$');
  return parts.length === 6 && parts[0] === 'scrypt' ? parts : null;
}

/** Reject parameters outside the accepted scrypt range before deriving. */
function parseScryptParameters(parts: string[]): { n: number; r: number; p: number } | null {
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }
  if (n < 1024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) {
    return null;
  }
  return { n, r, p };
}

function decodePasswordBuffers(parts: string[]): { salt: Buffer; expected: Buffer } | null {
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? '', 'base64url');
    expected = Buffer.from(parts[5] ?? '', 'base64url');
  } catch {
    return null;
  }
  if (salt.length < 8 || expected.length < 16) {
    return null;
  }
  return { salt, expected };
}
