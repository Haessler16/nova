import { BadRequestException } from '@nestjs/common';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordPolicyViolation {
  code: 'length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol' | 'whitespace' | 'email' | 'name';
  message: string;
}

/**
 * Shared password policy used by password reset, password change and
 * membership invitation. The backend is authoritative; the web app may
 * duplicate this for UX only.
 */
export function evaluatePasswordPolicy(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push({
      code: 'length',
      message: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push({
      code: 'length',
      message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }
  if (!/[a-z]/.test(password)) {
    violations.push({ code: 'lowercase', message: 'Password must contain a lowercase letter.' });
  }
  if (!/[A-Z]/.test(password)) {
    violations.push({ code: 'uppercase', message: 'Password must contain an uppercase letter.' });
  }
  if (!/[0-9]/.test(password)) {
    violations.push({ code: 'digit', message: 'Password must contain a digit.' });
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    violations.push({ code: 'symbol', message: 'Password must contain a symbol.' });
  }
  if (/\s/.test(password)) {
    violations.push({ code: 'whitespace', message: 'Password must not contain whitespace.' });
  }

  const normalized = password.toLowerCase();
  const email = context.email?.trim().toLowerCase();
  if (email !== undefined && email.length > 0) {
    const localPart = email.split('@')[0] ?? '';
    if (normalized.includes(email) || (localPart.length >= 3 && normalized.includes(localPart))) {
      violations.push({
        code: 'email',
        message: 'Password must not contain the account email.',
      });
    }
  }

  const name = context.name?.trim().toLowerCase();
  if (name !== undefined && name.length >= 3 && normalized.includes(name)) {
    violations.push({ code: 'name', message: 'Password must not contain the account name.' });
  }

  return violations;
}

export function assertPasswordPolicy(
  password: string,
  context: { email?: string; name?: string } = {},
): void {
  const violations = evaluatePasswordPolicy(password, context);
  if (violations.length > 0) {
    throw new BadRequestException({
      code: 'password_policy_violation',
      message: `Password does not meet the security policy: ${violations
        .map((violation) => violation.message)
        .join(' ')}`,
      details: {
        violations: violations.map((violation) => violation.code),
        requirements: {
          minLength: PASSWORD_MIN_LENGTH,
          maxLength: PASSWORD_MAX_LENGTH,
          lowercase: true,
          uppercase: true,
          digit: true,
          symbol: true,
          whitespaceAllowed: false,
          mustNotContainEmailOrName: true,
        },
      },
    });
  }
}
