import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_WINDOW = 1;
const SECRET_BYTES = 20;

export interface TotpVerification {
  step: number;
}

/**
 * RFC 6238 TOTP using Node's built-in HMAC-SHA1. The current standard
 * authenticator apps accept SHA1/6 digits/30 seconds, so no dependency is
 * needed for this narrow scope.
 */
export class TotpService {
  generateSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
  }

  codeForStep(secret: string, step: number, digits = DEFAULT_DIGITS): string {
    const key = base32Decode(secret);
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));

    const digest = createHmac('sha1', key).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return (binary % 10 ** digits).toString().padStart(digits, '0');
  }

  stepForDate(at: Date = new Date(), periodSeconds = DEFAULT_PERIOD_SECONDS): number {
    return Math.floor(at.getTime() / 1000 / periodSeconds);
  }

  verify(
    secret: string,
    code: string,
    options: { at?: Date; window?: number; digits?: number } = {},
  ): TotpVerification | null {
    const digits = options.digits ?? DEFAULT_DIGITS;
    if (!new RegExp(`^\\d{${digits}}$`).test(code)) {
      return null;
    }

    const currentStep = this.stepForDate(options.at ?? new Date());
    const window = options.window ?? DEFAULT_WINDOW;
    const expected = Buffer.from(code, 'utf8');

    // Check every accepted step instead of returning early so a caller cannot
    // infer which window matched from timing differences between windows.
    let matchedStep: number | null = null;
    for (let offset = -window; offset <= window; offset += 1) {
      const step = currentStep + offset;
      if (step < 0) {
        continue;
      }
      const candidate = Buffer.from(this.codeForStep(secret, step, digits), 'utf8');
      const equal = candidate.length === expected.length && timingSafeEqual(candidate, expected);
      if (equal && matchedStep === null) {
        matchedStep = step;
      }
    }

    return matchedStep === null ? null : { step: matchedStep };
  }

  provisioningUri(input: { secret: string; email: string; issuer: string }): string {
    const label = `${input.issuer}:${input.email}`;
    const params = new URLSearchParams({
      secret: input.secret,
      issuer: input.issuer,
      algorithm: 'SHA1',
      digits: String(DEFAULT_DIGITS),
      period: String(DEFAULT_PERIOD_SECONDS),
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(encoded: string): Buffer {
  const normalized = encoded.replace(/=+$/g, '').toUpperCase();
  if (normalized.length === 0 || /[^A-Z2-7]/.test(normalized)) {
    throw new Error('Invalid base32 secret.');
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error('Invalid base32 secret.');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
