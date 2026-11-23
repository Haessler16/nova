import type { CashMovementType, CashSession, OperationalClose } from '@/lib/types';
import {
  buildErrors,
  calendarDateField,
  moneyField,
  optionalText,
  reasonField,
  requiredText,
  type FieldErrors,
} from '@/lib/validation';

export const MOVEMENT_TYPES: CashMovementType[] = ['CASH_IN', 'CASH_OUT', 'REFUND', 'ADJUSTMENT'];

export interface CashSessionList {
  items: CashSession[];
}

export interface OperationalCloseList {
  items: OperationalClose[];
}

export interface OpenCashForm {
  name: string;
  operationalDate: string;
  openingAmount: string;
}

export interface MovementForm {
  type: CashMovementType;
  amount: string;
  description: string;
}

export interface CloseCashForm {
  closingAmount: string;
  varianceReason: string;
  notes: string;
}

export interface AuditForm {
  operationalDate: string;
  force: boolean;
  forceReason: string;
  notes: string;
}

export const EMPTY_OPEN_FORM: OpenCashForm = {
  name: '',
  operationalDate: '',
  openingAmount: '0.00',
};

export const EMPTY_MOVEMENT_FORM: MovementForm = {
  type: 'CASH_IN',
  amount: '',
  description: '',
};

export const EMPTY_CLOSE_FORM: CloseCashForm = {
  closingAmount: '',
  varianceReason: '',
  notes: '',
};

export const EMPTY_AUDIT_FORM: AuditForm = {
  operationalDate: '',
  force: false,
  forceReason: '',
  notes: '',
};

export function openFormErrors(form: OpenCashForm): FieldErrors {
  return buildErrors([
    ['open.name', requiredText(form.name, 'El nombre de la sesión', { max: 120 })],
    ['open.operationalDate', calendarDateField(form.operationalDate, 'El día operativo')],
    ['open.openingAmount', moneyField(form.openingAmount, 'El fondo inicial')],
  ]);
}

export function movementFormErrors(form: MovementForm): FieldErrors {
  return buildErrors([
    ['movement.amount', moneyField(form.amount, 'El importe', { allowZero: false })],
    ['movement.description', optionalText(form.description, 'El detalle', { max: 4000 })],
  ]);
}

export function closeFormErrors(form: CloseCashForm): FieldErrors {
  return buildErrors([
    ['close.closingAmount', moneyField(form.closingAmount, 'El efectivo contado')],
    ['close.varianceReason', optionalText(form.varianceReason, 'El motivo de diferencia', { max: 500 })],
    ['close.notes', optionalText(form.notes, 'Las notas', { max: 4000 })],
  ]);
}

export function auditFormErrors(form: AuditForm): FieldErrors {
  return buildErrors([
    ['audit.operationalDate', calendarDateField(form.operationalDate, 'El día operativo')],
    [
      'audit.forceReason',
      form.force
        ? reasonField(form.forceReason, 'El motivo del cierre forzado')
        : optionalText(form.forceReason, 'El motivo', { max: 500 }),
    ],
    ['audit.notes', optionalText(form.notes, 'Las notas', { max: 4000 })],
  ]);
}

export function reopenErrors(reason: string): FieldErrors {
  return buildErrors([['reopen.reason', reasonField(reason)]]);
}
