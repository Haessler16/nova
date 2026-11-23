import { splitAttributes } from '@/lib/format';
import type {
  IncidentSeverity,
  IncidentType,
  Room,
  RoomListFacets,
  RoomListSummary,
  RoomType,
} from '@/lib/types';
import {
  blockRangeField,
  buildErrors,
  datetimeLocalField,
  reasonField,
  type FieldErrors,
} from '@/lib/validation';

export interface RoomsData {
  rooms: Room[];
  roomTypes: RoomType[];
  summary: RoomListSummary;
  facets: RoomListFacets;
}

export interface RoomsFilters {
  search: string;
  roomTypeId: string;
  floor: string;
  building: string;
  minCapacity: string;
  occupancy: string;
  operationalState: string;
  housekeepingState: string;
}

export const EMPTY_FILTERS: RoomsFilters = {
  search: '',
  roomTypeId: '',
  floor: '',
  building: '',
  minCapacity: '',
  occupancy: '',
  operationalState: '',
  housekeepingState: '',
};

export interface RoomForm {
  number: string;
  roomTypeId: string;
  floor: string;
  building: string;
  attributes: string;
  status: 'ACTIVE' | 'DISABLED';
}

export const EMPTY_ROOM_FORM: RoomForm = {
  number: '',
  roomTypeId: '',
  floor: '',
  building: '',
  attributes: '',
  status: 'ACTIVE',
};

export interface BlockForm {
  type: string;
  reason: string;
  startsAt: string;
  endsAt: string;
}

export interface IncidentDraft {
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
}

export const EMPTY_INCIDENT: IncidentDraft = {
  type: 'NOTE',
  severity: 'MEDIUM',
  title: '',
  description: '',
};

export function localDateTimeInput(offsetHours = 0): string {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function emptyBlockForm(): BlockForm {
  return {
    type: 'OUT_OF_ORDER',
    reason: '',
    startsAt: localDateTimeInput(),
    endsAt: localDateTimeInput(24),
  };
}

export function blockFormErrors(form: BlockForm): FieldErrors {
  return buildErrors([
    ['reason', reasonField(form.reason)],
    ['startsAt', datetimeLocalField(form.startsAt, 'El inicio del bloqueo')],
    [
      'endsAt',
      datetimeLocalField(form.endsAt, 'El fin del bloqueo') ??
        blockRangeField(form.startsAt, form.endsAt),
    ],
  ]);
}

function baseRoomBody(form: RoomForm): {
  number: string;
  roomTypeId: string;
  attributes: string[];
  floor?: string;
  building?: string;
} {
  return {
    number: form.number.trim(),
    roomTypeId: form.roomTypeId,
    // Empty optional fields are omitted, matching the create payload and
    // avoiding a 400 from @Length(1,32) on an empty string.
    ...(form.floor.trim() !== '' ? { floor: form.floor.trim() } : {}),
    ...(form.building.trim() !== '' ? { building: form.building.trim() } : {}),
    attributes: splitAttributes(form.attributes),
  };
}

export function createRoomBody(form: RoomForm): ReturnType<typeof baseRoomBody> {
  return baseRoomBody(form);
}

export function updateRoomBody(form: RoomForm): ReturnType<typeof baseRoomBody> & {
  status: 'ACTIVE' | 'DISABLED';
} {
  return { ...baseRoomBody(form), status: form.status };
}

export function roomFormFrom(room: Room): RoomForm {
  return {
    number: room.number,
    roomTypeId: room.roomTypeId,
    floor: room.floor ?? '',
    building: room.building ?? '',
    attributes: room.attributes.join(', '),
    status: room.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  };
}
