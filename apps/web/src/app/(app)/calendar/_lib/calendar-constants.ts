import type { Reservation } from '@/lib/types';

export const DAY_WIDTH = 76;
export const ROOM_COLUMN_WIDTH = 168;

export const BAR_COLORS: Record<Reservation['status'], string> = {
  CONFIRMED: 'brand.500',
  CHECKED_IN: 'mint.500',
  CHECKED_OUT: 'sky.500',
  CANCELLED: 'gray.400',
  NO_SHOW: 'warning.500',
};
