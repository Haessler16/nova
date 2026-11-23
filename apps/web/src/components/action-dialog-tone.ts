import type { TranslationKey } from '@/lib/i18n';
import { AlertTriangleIcon, InfoIcon } from './icons';

export type ActionDialogTone = 'info' | 'warning' | 'critical';

export interface ActionDialogToneStyles {
  eyebrowKey: TranslationKey;
  iconBg: string;
  iconColor: string;
  confirmScheme: 'brand' | 'warning' | 'danger';
  icon: typeof InfoIcon;
}

export const TONE_STYLES: Record<ActionDialogTone, ActionDialogToneStyles> = {
  info: {
    eyebrowKey: 'actionDialog.tone.info',
    iconBg: 'brand.50',
    iconColor: 'brand.600',
    confirmScheme: 'brand',
    icon: InfoIcon,
  },
  warning: {
    eyebrowKey: 'actionDialog.tone.warning',
    iconBg: 'warning.50',
    iconColor: 'warning.700',
    confirmScheme: 'warning',
    icon: AlertTriangleIcon,
  },
  critical: {
    eyebrowKey: 'actionDialog.tone.critical',
    iconBg: 'danger.50',
    iconColor: 'danger.600',
    confirmScheme: 'danger',
    icon: AlertTriangleIcon,
  },
};
