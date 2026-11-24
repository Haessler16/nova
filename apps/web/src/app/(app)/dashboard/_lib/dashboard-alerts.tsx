import type { ReactNode } from 'react';
import { AlertTriangleIcon, RoomsIcon } from '@/components/icons';
import type { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';

export interface DashboardAlert {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  tone: 'danger' | 'warning';
}

export function buildDashboardAlerts(
  t: ReturnType<typeof useI18n>['t'],
  data: FrontOfficeOverview | null,
): DashboardAlert[] {
  const dirtyRooms =
    data?.roomRack.filter(
      (room) => room.housekeepingState === 'DIRTY' || room.housekeepingState === 'CLEANING',
    ).length ?? 0;
  const outOfService =
    data?.roomRack.filter((room) => room.operationalState !== 'AVAILABLE').length ?? 0;
  const noShow = data?.counts.noShowCandidates ?? 0;

  return [
    ...(noShow > 0
      ? [
          {
            title:
              noShow === 1
                ? t('dashboard.alerts.noShowOne', { count: noShow })
                : t('dashboard.alerts.noShowOther', { count: noShow }),
            description: t('dashboard.alerts.noShowDescription'),
            href: '/front-office?tab=arrivals',
            icon: <AlertTriangleIcon boxSize={4} />,
            tone: 'danger' as const,
          },
        ]
      : []),
    ...(dirtyRooms > 0
      ? [
          {
            title:
              dirtyRooms === 1
                ? t('dashboard.alerts.dirtyOne', { count: dirtyRooms })
                : t('dashboard.alerts.dirtyOther', { count: dirtyRooms }),
            description: t('dashboard.alerts.dirtyDescription'),
            href: '/front-office?tab=rack',
            icon: <RoomsIcon boxSize={4} />,
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(outOfService > 0
      ? [
          {
            title:
              outOfService === 1
                ? t('dashboard.alerts.outOfServiceOne', { count: outOfService })
                : t('dashboard.alerts.outOfServiceOther', { count: outOfService }),
            description: t('dashboard.alerts.outOfServiceDescription'),
            href: '/inventory/rooms',
            icon: <RoomsIcon boxSize={4} />,
            tone: 'warning' as const,
          },
        ]
      : []),
  ];
}
