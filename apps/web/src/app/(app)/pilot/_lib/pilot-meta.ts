import type { TranslationKey } from '@/lib/i18n';
import type { PilotFeedbackCategory, PilotFeedbackStatus } from '@/lib/pilot-types';

export const CATEGORY_KEYS: Record<PilotFeedbackCategory, TranslationKey> = {
  BUG: 'pilot.category.BUG',
  UX: 'pilot.category.UX',
  QUESTION: 'pilot.category.QUESTION',
  OTHER: 'pilot.category.OTHER',
};

export const STATUS_META: Record<PilotFeedbackStatus, { color: string; key: TranslationKey }> = {
  OPEN: { color: 'warning', key: 'pilot.status.OPEN' },
  REVIEWED: { color: 'mint', key: 'pilot.status.REVIEWED' },
  ARCHIVED: { color: 'gray', key: 'pilot.status.ARCHIVED' },
};
