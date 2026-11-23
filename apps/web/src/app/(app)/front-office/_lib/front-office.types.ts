import type { useSession } from '@/context/session';
import { errorMessage, isApiError } from '@/lib/api';
import type { useI18n } from '@/lib/i18n';
import type {
  HousekeepingState,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  ReservationStatus,
  RoomBlockType,
  RoomMoveBlockerCode,
  RoomMoveCandidate,
} from '@/lib/types';

export type Tenant = ReturnType<typeof useSession>['tenant'];

export type Translator = ReturnType<typeof useI18n>['t'];

export interface IncidentList {
  items: Incident[];
}

export type IncidentScope = 'none' | 'stay' | 'room';

export interface MoveFilters {
  roomTypeId: string;
  floor: string;
  building: string;
  housekeeping: '' | HousekeepingState;
  search: string;
  showIneligible: boolean;
}

export const EMPTY_MOVE_FILTERS: MoveFilters = {
  roomTypeId: '',
  floor: '',
  building: '',
  housekeeping: '',
  search: '',
  showIneligible: false,
};

export interface SearchFilters {
  q: string;
  fromDate: string;
  toDate: string;
  status: ReservationStatus | '';
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  q: '',
  fromDate: '',
  toDate: '',
  status: '',
};

export const INCIDENT_TYPES: IncidentType[] = [
  'NOTE',
  'MAINTENANCE',
  'COMPLAINT',
  'SAFETY',
  'OTHER',
];

export const TAB_INDEX: Record<string, number> = {
  arrivals: 0,
  'in-house': 1,
  departures: 2,
  rack: 3,
  incidents: 4,
};

export interface IncidentForm {
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  scope: IncidentScope;
  stayId: string;
  roomId: string;
}

export const EMPTY_INCIDENT_FORM: IncidentForm = {
  type: 'NOTE',
  severity: 'MEDIUM',
  title: '',
  description: '',
  scope: 'none',
  stayId: '',
  roomId: '',
};

export interface MoveResult {
  fromNumber: string;
  toNumber: string;
}

export function roomMoveBlockerLabel(t: Translator, code: RoomMoveBlockerCode): string {
  switch (code) {
    case 'room_inactive':
      return t('frontOffice.move.blocker.roomInactive');
    case 'room_out_of_service':
      return t('frontOffice.move.blocker.outOfService');
    case 'room_type_mismatch':
      return t('frontOffice.move.blocker.typeMismatch');
    case 'room_block_overlap':
      return t('frontOffice.move.blocker.blockOverlap');
    case 'room_occupied':
      return t('frontOffice.move.blocker.occupied');
    case 'room_not_available':
      return t('frontOffice.move.blocker.notAvailable');
  }
}

export function blockTypeLabel(t: Translator, type: RoomBlockType): string {
  return t(type === 'OUT_OF_ORDER' ? 'operational.outOfOrder' : 'operational.outOfService');
}

export function nightsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.nightsOne' : 'common.nightsOther', { count });
}

export function adultsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.adultsOne' : 'common.adultsOther', { count });
}

export function minorsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.minorsOne' : 'common.minorsOther', { count });
}

/** Friendly, actionable version of the transaction's conflict codes. */
export function roomMoveErrorMessage(error: unknown, t: Translator): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'room_occupied':
        return t('frontOffice.move.error.occupied');
      case 'room_block_overlap':
        return t('frontOffice.move.error.blockOverlap');
      case 'room_not_available':
        return t('frontOffice.move.error.notAvailable');
      case 'room_out_of_service':
        return t('frontOffice.move.error.outOfService');
      case 'room_type_mismatch':
        return t('frontOffice.move.error.typeMismatch');
      case 'stay_not_in_house':
        return t('frontOffice.move.error.stayNotInHouse');
    }
  }
  return errorMessage(error);
}

export function filterMoveCandidates(
  rooms: RoomMoveCandidate[],
  filters: MoveFilters,
): RoomMoveCandidate[] {
  const search = filters.search.trim().toLowerCase();
  return rooms.filter((room) => {
    if (filters.roomTypeId !== '' && room.roomType.id !== filters.roomTypeId) {
      return false;
    }
    if (filters.floor !== '' && (room.floor ?? '') !== filters.floor) {
      return false;
    }
    if (filters.building !== '' && (room.building ?? '') !== filters.building) {
      return false;
    }
    if (filters.housekeeping !== '' && room.housekeepingState !== filters.housekeeping) {
      return false;
    }
    if (search !== '' && !room.number.toLowerCase().includes(search)) {
      return false;
    }
    if (!filters.showIneligible && !room.eligible) {
      return false;
    }
    return true;
  });
}

export function moveFilterOptions(rooms: RoomMoveCandidate[]): {
  roomTypes: RoomMoveCandidate['roomType'][];
  floors: string[];
  buildings: string[];
} {
  const roomTypes = Array.from(
    new Map(rooms.map((room) => [room.roomType.id, room.roomType])).values(),
  );
  const floors = Array.from(
    new Set(rooms.map((room) => room.floor).filter((value): value is string => value !== null)),
  ).sort();
  const buildings = Array.from(
    new Set(
      rooms.map((room) => room.building).filter((value): value is string => value !== null),
    ),
  ).sort();
  return { roomTypes, floors, buildings };
}
