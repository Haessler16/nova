import { useI18n } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import type {
  InstructionActionType,
  InstructionCategory,
  InstructionEvent,
  InstructionExecutionMoment,
  InstructionPriority,
  InstructionStatus,
  InstructionVisibility,
} from '@/lib/types';

export const CATEGORY_OPTIONS: InstructionCategory[] = [
  'GENERAL',
  'PAYMENT',
  'MEAL',
  'BILLING',
  'ROOM',
  'ARRIVAL',
  'IMPORTANT',
  'EXTRA',
  'CONFIDENTIAL',
];

export const PRIORITY_OPTIONS: InstructionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export const VISIBILITY_OPTIONS: InstructionVisibility[] = [
  'ALL_AUTHORIZED',
  'FRONT_DESK',
  'RESERVATIONS',
  'FINANCE',
  'MANAGEMENT',
];

export const ACTION_OPTIONS: InstructionActionType[] = [
  'PAYMENT_PREAUTHORIZATION',
  'VERIFY_PAYMENT',
  'BILLING_TASK',
  'ARRIVAL_REMINDER',
];

export const MOMENT_OPTIONS: InstructionExecutionMoment[] = [
  'PRE_ARRIVAL',
  'CHECK_IN',
  'DURING_STAY',
  'CHECK_OUT',
];

export const STATUS_ACTIONS: Array<{
  status: InstructionStatus;
  labelKey: TranslationKey;
  path: string;
  variant?: 'solid' | 'outline' | 'ghost';
}> = [
  {
    status: 'ACKNOWLEDGED',
    labelKey: 'instructions.action.acknowledge',
    path: 'acknowledge',
    variant: 'outline',
  },
  {
    status: 'IN_PROGRESS',
    labelKey: 'instructions.action.start',
    path: 'start',
    variant: 'outline',
  },
  { status: 'COMPLETED', labelKey: 'instructions.action.complete', path: 'complete' },
  {
    status: 'DISMISSED',
    labelKey: 'instructions.action.dismiss',
    path: 'dismiss',
    variant: 'ghost',
  },
];

const EVENT_LABEL_KEYS: Record<InstructionEvent['eventType'], TranslationKey> = {
  CREATED: 'instructions.event.created',
  UPDATED: 'instructions.event.updated',
  ACKNOWLEDGED: 'instructions.event.acknowledged',
  IN_PROGRESS: 'instructions.event.inProgress',
  COMPLETED: 'instructions.event.completed',
  DISMISSED: 'instructions.event.dismissed',
  NEEDS_CLARIFICATION: 'instructions.event.needsClarification',
  CONFIRMED_FROM_SOURCE: 'instructions.event.confirmedFromSource',
};

export function eventLabel(
  t: ReturnType<typeof useI18n>['t'],
  eventType: InstructionEvent['eventType'],
): string {
  return t(EVENT_LABEL_KEYS[eventType]);
}

export function toDateTimeLocal(value: string | null): string {
  if (value === null) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .slice(0, 10);
}

export function canTransition(from: InstructionStatus, to: InstructionStatus): boolean {
  switch (from) {
    case 'NEW':
      return true;
    case 'ACKNOWLEDGED':
      return to !== 'ACKNOWLEDGED';
    case 'IN_PROGRESS':
      return to === 'COMPLETED' || to === 'DISMISSED' || to === 'NEEDS_CLARIFICATION';
    case 'NEEDS_CLARIFICATION':
      return to === 'ACKNOWLEDGED' || to === 'DISMISSED' || to === 'IN_PROGRESS';
    case 'COMPLETED':
    case 'DISMISSED':
      return false;
    default:
      return false;
  }
}

export interface NewInstructionDraft {
  category: InstructionCategory;
  priority: InstructionPriority;
  visibility: InstructionVisibility;
  title: string;
  body: string;
  tags: string;
  assignedDepartment: string;
  actionType: '' | InstructionActionType;
  executionMoment: '' | InstructionExecutionMoment;
  validFrom: string;
  validUntil: string;
}

export const EMPTY_NEW_INSTRUCTION: NewInstructionDraft = {
  category: 'GENERAL',
  priority: 'NORMAL',
  visibility: 'ALL_AUTHORIZED',
  title: '',
  body: '',
  tags: '',
  assignedDepartment: '',
  actionType: '',
  executionMoment: '',
  validFrom: '',
  validUntil: '',
};

export interface EditInstructionDraft {
  title: string;
  body: string;
  tags: string;
  priority: InstructionPriority;
  visibility: InstructionVisibility;
  assignedDepartment: string;
  validFrom: string;
  validUntil: string;
}

export const EMPTY_EDIT_INSTRUCTION: EditInstructionDraft = {
  title: '',
  body: '',
  tags: '',
  priority: 'NORMAL',
  visibility: 'ALL_AUTHORIZED',
  assignedDepartment: '',
  validFrom: '',
  validUntil: '',
};
