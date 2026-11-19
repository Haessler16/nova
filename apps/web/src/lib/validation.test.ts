import { describe, expect, it } from 'vitest';
import {
  buildErrors,
  calendarDateField,
  emailField,
  hasErrors,
  moneyField,
  phoneField,
  requiredText,
} from './validation';

describe('validation helpers', () => {
  it('collects only the present errors', () => {
    const errors = buildErrors([
      ['fullName', null],
      ['email', 'Email inválido.'],
    ]);

    expect(errors).toEqual({ email: 'Email inválido.' });
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });

  it('requires trimmed text and respects the minimum length', () => {
    expect(requiredText('   ', 'El nombre')).toBe('El nombre es obligatorio.');
    expect(requiredText(' Ana ', 'El nombre')).toBeNull();
    expect(requiredText('Al', 'El nombre', { min: 3 })).toContain('al menos 3');
  });

  it('validates optional and required emails', () => {
    expect(emailField('')).toBeNull();
    expect(emailField('', { required: true })).toContain('obligatorio');
    expect(emailField('ana@example.com')).toBeNull();
    expect(emailField('ana.example.com')).toContain('válido');
  });

  it('accepts only the documented phone shape', () => {
    expect(phoneField('')).toBeNull();
    expect(phoneField('+55 (11) 99999-0000')).toBeNull();
    expect(phoneField('call me')).toContain('dígitos');
  });

  it('accepts decimal money strings but never comma decimals', () => {
    expect(moneyField('150.00', 'El importe')).toBeNull();
    expect(moneyField('10,00', 'El importe')).toContain('dos decimales');
    expect(moneyField('0.00', 'El importe', { allowZero: false })).toContain('mayor que cero');
  });

  it('rejects impossible calendar dates', () => {
    expect(calendarDateField('2026-02-31', 'La fecha')).toContain('fecha válida');
    expect(calendarDateField('2026-02-28', 'La fecha')).toBeNull();
    expect(calendarDateField('', 'La fecha')).toContain('obligatorio');
  });
});
