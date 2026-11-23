import { createIcon } from '@chakra-ui/react';
import { strokeProps } from './icon-stroke';

/** Operational and status glyphs. */

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

export const InfoIcon = createIcon({
  displayName: 'InfoIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="12" r="9" {...strokeProps} />
      <path d="M12 11v5M12 8h.01" {...strokeProps} />
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

export const MoonIcon = createIcon({
  displayName: 'MoonIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79zM8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        {...strokeProps}
      />
    </>
  ),
});

export const SunIcon = createIcon({
  displayName: 'SunIcon',
  viewBox: '0 0 24 24',
  path: (
    <>
      <circle cx="12" cy="12" r="5" {...strokeProps} />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        {...strokeProps}
      />
    </>
  ),
});
