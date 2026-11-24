import type { I18nValue } from '@/lib/i18n';
import type { CashMovementType, CashSession, OperationalClose } from '@/lib/types';
import {
  buildErrors,
  calendarDateField,
  moneyField,
  optionalText,
  reasonField,
  requiredText,
  type FieldErrors,
  type ValidationCopy,
} from '@/lib/validation';
import { validationCopy } from '../../reservations/_lib/reservation-labels';

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

type Translate = I18nValue['t'];

function copyOf(t: Translate): ValidationCopy {
  return validationCopy(t);
}

export function openFormErrors(form: OpenCashForm, t: Translate): FieldErrors {
  const copy = copyOf(t);
  return buildErrors([
    ['open.name', requiredText(form.name, t('cashier.forms.sessionName'), { max: 120 }, copy)],
    [
      'open.operationalDate',
      calendarDateField(form.operationalDate, t('cashier.forms.operationalDate'), copy),
    ],
    [
      'open.openingAmount',
      moneyField(form.openingAmount, t('cashier.forms.openingAmount'), {}, copy),
    ],
  ]);
}

export function movementFormErrors(form: MovementForm, t: Translate): FieldErrors {
  const copy = copyOf(t);
  return buildErrors([
    [
      'movement.amount',
      moneyField(form.amount, t('cashier.forms.amount'), { allowZero: false }, copy),
    ],
    [
      'movement.description',
      optionalText(form.description, t('cashier.forms.detail'), { max: 4000 }, copy),
    ],
  ]);
}

export function closeFormErrors(form: CloseCashForm, t: Translate): FieldErrors {
  const copy = copyOf(t);
  return buildErrors([
    [
      'close.closingAmount',
      moneyField(form.closingAmount, t('cashier.forms.closingAmount'), {}, copy),
    ],
    [
      'close.varianceReason',
      optionalText(form.varianceReason, t('cashier.forms.varianceReason'), { max: 500 }, copy),
    ],
    ['close.notes', optionalText(form.notes, t('cashier.forms.notes'), { max: 4000 }, copy)],
  ]);
}

export function auditFormErrors(form: AuditForm, t: Translate): FieldErrors {
  const copy = copyOf(t);
  return buildErrors([
    [
      'audit.operationalDate',
      calendarDateField(form.operationalDate, t('cashier.forms.operationalDate'), copy),
    ],
    [
      'audit.forceReason',
      form.force
        ? reasonField(form.forceReason, t('cashier.forms.forceReason'), {}, copy)
        : optionalText(form.forceReason, t('cashier.forms.reason'), { max: 500 }, copy),
    ],
    ['audit.notes', optionalText(form.notes, t('cashier.forms.notes'), { max: 4000 }, copy)],
  ]);
}

export function reopenErrors(reason: string, t: Translate): FieldErrors {
  return buildErrors([
    ['reopen.reason', reasonField(reason, t('cashier.forms.reason'), {}, copyOf(t))],
  ]);
}
