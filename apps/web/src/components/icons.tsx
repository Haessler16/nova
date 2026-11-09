import { createIcon } from '@chakra-ui/react';

/**
 * Small inline icon set based on Lucide geometry. Keeping the icons local
 * avoids adding an icon dependency for the handful of glyphs the shell needs.
 */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const DashboardIcon = createIcon({
  displayName: 'DashboardIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" {...strokeProps} />
      <rect x="14" y="3" width="7" height="5" rx="1.5" {...strokeProps} />
      <rect x="14" y="12" width="7" height="9" rx="1.5" {...strokeProps} />
      <rect x="3" y="16" width="7" height="5" rx="1.5" {...strokeProps} />
    </>
  ),
});

export const PilotIcon = createIcon({
  displayName: 'PilotIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="12" r="8" {...strokeProps} />
      <path d="m15.5 8.5-2 5-5 2 2-5z" {...strokeProps} />
    </>
  ),
});

export const ImportIcon = createIcon({
  displayName: 'ImportIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 3v11" {...strokeProps} />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" {...strokeProps} />
      <path d="M4 16v4h16v-4" {...strokeProps} />
    </>
  ),
});

export const DownloadIcon = createIcon({
  displayName: 'DownloadIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 3v12" {...strokeProps} />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" {...strokeProps} />
      <path d="M4 20h16" {...strokeProps} />
    </>
  ),
});

export const FrontDeskIcon = createIcon({
  displayName: 'FrontDeskIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M3 20h18" {...strokeProps} />
      <path d="M5 20v-5a7 7 0 0 1 14 0v5" {...strokeProps} />
      <path d="M12 8V5" {...strokeProps} />
      <path d="M9.5 5h5" {...strokeProps} />
    </>
  ),
});

export const CalendarIcon = createIcon({
  displayName: 'CalendarIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" {...strokeProps} />
      <path d="M16 3v4M8 3v4M3 11h18" {...strokeProps} />
    </>
  ),
});

export const ReservationIcon = createIcon({
  displayName: 'ReservationIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z" {...strokeProps} />
      <path d="M8 8h8M8 12h8M8 16h5" {...strokeProps} />
    </>
  ),
});

export const GuestsIcon = createIcon({
  displayName: 'GuestsIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="9" cy="8" r="3.2" {...strokeProps} />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" {...strokeProps} />
      <circle cx="17" cy="9" r="2.4" {...strokeProps} />
      <path d="M16 14.4A4.6 4.6 0 0 1 20.5 19" {...strokeProps} />
    </>
  ),
});

export const RoomsIcon = createIcon({
  displayName: 'RoomsIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M3 20V9" {...strokeProps} />
      <path d="M21 20v-6a3 3 0 0 0-3-3H7a4 4 0 0 0-4 4" {...strokeProps} />
      <path d="M7 11V8a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 8v3" {...strokeProps} />
      <path d="M3 17h18" {...strokeProps} />
    </>
  ),
});

export const RoomTypesIcon = createIcon({
  displayName: 'RoomTypesIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M20 13 11 4H4v7l9 9a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" {...strokeProps} />
      <circle cx="8" cy="8" r="1.3" {...strokeProps} />
    </>
  ),
});

export const PropertyIcon = createIcon({
  displayName: 'PropertyIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" {...strokeProps} />
      <path
        d="M9 21v-5h6v5M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"
        {...strokeProps}
      />
    </>
  ),
});

export const AuditIcon = createIcon({
  displayName: 'AuditIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.4 7 10 4.1-1.6 7-5.6 7-10V6z" {...strokeProps} />
      <path d="m9 12 2 2 4-4" {...strokeProps} />
    </>
  ),
});

export const AdminIcon = createIcon({
  displayName: 'AdminIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="12" r="3" {...strokeProps} />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        {...strokeProps}
      />
    </>
  ),
});

export const AccountIcon = createIcon({
  displayName: 'AccountIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="8.5" r="3.5" {...strokeProps} />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" {...strokeProps} />
    </>
  ),
});

export const MenuIcon = createIcon({
  displayName: 'MenuIcon',
  viewBox: '0 0 24 24',
  path: <path d="M4 7h16M4 12h16M4 17h16" {...strokeProps} />,
});

export const ChevronDownIcon = createIcon({
  displayName: 'ChevronDownIcon',
  viewBox: '0 0 24 24',
  path: <path d="m6 9 6 6 6-6" {...strokeProps} />,
});

export const ArrowRightIcon = createIcon({
  displayName: 'ArrowRightIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M5 12h14" {...strokeProps} />
      <path d="m13 6 6 6-6 6" {...strokeProps} />
    </>
  ),
});

export const LogoutIcon = createIcon({
  displayName: 'LogoutIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" {...strokeProps} />
      <path d="m16 16 4-4-4-4M20 12H9" {...strokeProps} />
    </>
  ),
});

export const BedIcon = createIcon({
  displayName: 'BedIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M3 20V8" {...strokeProps} />
      <path d="M21 20v-5a3 3 0 0 0-3-3H3" {...strokeProps} />
      <path d="M7 12V9.5A1.5 1.5 0 0 1 8.5 8h3A1.5 1.5 0 0 1 13 9.5V12" {...strokeProps} />
      <path d="M3 16h18" {...strokeProps} />
    </>
  ),
});

export const ArrivalIcon = createIcon({
  displayName: 'ArrivalIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 3v11" {...strokeProps} />
      <path d="m8 10 4 4 4-4" {...strokeProps} />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" {...strokeProps} />
    </>
  ),
});

export const DepartureIcon = createIcon({
  displayName: 'DepartureIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 14V3" {...strokeProps} />
      <path d="m8 7 4-4 4 4" {...strokeProps} />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" {...strokeProps} />
    </>
  ),
});

export const KeyIcon = createIcon({
  displayName: 'KeyIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="8" cy="15" r="4" {...strokeProps} />
      <path d="m11 12 9-9M16 4l3 3M18.5 6.5 21 4" {...strokeProps} />
    </>
  ),
});

export const PlusIcon = createIcon({
  displayName: 'PlusIcon',
  viewBox: '0 0 24 24',
  path: <path d="M12 5v14M5 12h14" {...strokeProps} />,
});

export const GridIcon = createIcon({
  displayName: 'GridIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" {...strokeProps} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" {...strokeProps} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" {...strokeProps} />
      <rect x="14" y="14" width="7" height="7" rx="1.5" {...strokeProps} />
    </>
  ),
});

export const AlertTriangleIcon = createIcon({
  displayName: 'AlertTriangleIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M10.3 4.2 2.6 18a1.8 1.8 0 0 0 1.6 2.7h15.6a1.8 1.8 0 0 0 1.6-2.7L13.7 4.2a1.9 1.9 0 0 0-3.4 0z"
        {...strokeProps}
      />
      <path d="M12 9v4M12 17h.01" {...strokeProps} />
    </>
  ),
});

export const SparkleIcon = createIcon({
  displayName: 'SparkleIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" {...strokeProps} />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" {...strokeProps} />
    </>
  ),
});

export const CheckCircleIcon = createIcon({
  displayName: 'CheckCircleIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="12" r="9" {...strokeProps} />
      <path d="m8 12 2.5 2.5L16 9" {...strokeProps} />
    </>
  ),
});

export const WifiIcon = createIcon({
  displayName: 'WifiIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M4 9a12 12 0 0 1 16 0M7 12.5a8 8 0 0 1 10 0M10 16a3.5 3.5 0 0 1 4 0"
        {...strokeProps}
      />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </>
  ),
});

export const FolioIcon = createIcon({
  displayName: 'FolioIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M6 3h9l4 4v14H6z" {...strokeProps} />
      <path d="M15 3v5h4M9 12h7M9 16h7M9 8h2" {...strokeProps} />
    </>
  ),
});

export const CashIcon = createIcon({
  displayName: 'CashIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" {...strokeProps} />
      <circle cx="12" cy="12" r="2.6" {...strokeProps} />
      <path d="M6 9v6M18 9v6" {...strokeProps} />
    </>
  ),
});

export const NightAuditIcon = createIcon({
  displayName: 'NightAuditIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z" {...strokeProps} />
      <path d="M17 4v3M15.5 5.5h3" {...strokeProps} />
    </>
  ),
});
