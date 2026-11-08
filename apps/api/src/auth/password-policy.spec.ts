import { evaluatePasswordPolicy } from './password-policy';

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(
      evaluatePasswordPolicy('Nova-Secure!2026', {
        email: 'admin@demo.nova.local',
        name: 'Admin',
      }),
    ).toEqual([]);
  });

  it('rejects weak passwords with actionable codes', () => {
    const codes = evaluatePasswordPolicy('short', { email: 'a@b.com' }).map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining(['length', 'uppercase', 'digit', 'symbol']));
  });

  it('rejects passwords containing the email local part or name', () => {
    const codes = evaluatePasswordPolicy('AdminNova!2026xx', {
      email: 'other@demo.nova.local',
      name: 'Admin',
    }).map((v) => v.code);
    expect(codes).toContain('name');
  });

  it('rejects whitespace', () => {
    const codes = evaluatePasswordPolicy('Nova Secure!2026').map((v) => v.code);
    expect(codes).toContain('whitespace');
  });
});
