import type { useI18n } from '@/lib/i18n';

export function greetingLabel(t: ReturnType<typeof useI18n>['t'], localTime: string): string {
  const hour = Number(localTime.slice(0, 2));
  if (!Number.isFinite(hour)) {
    return t('dashboard.greeting.welcome');
  }
  if (hour < 12) {
    return t('dashboard.greeting.morning');
  }
  if (hour < 19) {
    return t('dashboard.greeting.afternoon');
  }
  return t('dashboard.greeting.evening');
}

export function firstName(name: string | undefined): string {
  if (name === undefined || name.trim() === '') {
    return '';
  }
  return name.trim().split(/\s+/)[0] ?? '';
}
