import { TotpService, base32Decode, base32Encode } from './totp.service';

describe('TotpService', () => {
  const totp = new TotpService();
  const secret = 'JBSWY3DPEHPK3PXP'; // base32 for "Hello!\xde\xad\xbe\xef"

  it('round-trips base32', () => {
    const encoded = base32Encode(Buffer.from('hello-totp-secret', 'utf8'));
    expect(base32Decode(encoded).toString('utf8')).toBe('hello-totp-secret');
  });

  it('generates deterministic codes for a known step', () => {
    const code = totp.codeForStep(secret, 1);
    expect(code).toMatch(/^\d{6}$/);
    expect(totp.codeForStep(secret, 1)).toBe(code);
  });

  it('verifies a valid code in the current window', () => {
    const at = new Date('2026-01-01T00:00:30.000Z');
    const step = totp.stepForDate(at);
    const code = totp.codeForStep(secret, step);
    expect(totp.verify(secret, code, { at, window: 0 })).toEqual({ step });
  });

  it('accepts adjacent windows and rejects outside the window', () => {
    const at = new Date('2026-01-01T00:01:00.000Z');
    const step = totp.stepForDate(at);
    const previous = totp.codeForStep(secret, step - 1);
    expect(totp.verify(secret, previous, { at, window: 1 })).toEqual({ step: step - 1 });
    expect(totp.verify(secret, previous, { at, window: 0 })).toBeNull();
  });

  it('rejects malformed codes', () => {
    expect(totp.verify(secret, 'abc123', { at: new Date() })).toBeNull();
    expect(totp.verify(secret, '12345', { at: new Date() })).toBeNull();
    expect(totp.verify(secret, '1234567', { at: new Date() })).toBeNull();
  });

  it('builds a provisioning URI', () => {
    const uri = totp.provisioningUri({
      secret,
      email: 'admin@demo.nova.local',
      issuer: 'NOVA PMS',
    });
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=NOVA+PMS');
  });
});
