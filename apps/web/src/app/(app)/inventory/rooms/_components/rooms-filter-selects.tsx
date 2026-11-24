'use client';

import { Select } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { RoomListFacets, RoomType } from '@/lib/types';
import type { RoomsFilters } from '../_lib/rooms';

export function RoomsFilterSelects({
  filters,
  onChange,
  roomTypes,
  facets,
}: {
  filters: RoomsFilters;
  onChange: (filters: RoomsFilters) => void;
  roomTypes: RoomType[] | undefined;
  facets: RoomListFacets | undefined;
}) {
  const { t } = useI18n();

  return (
    <>
      <Select
        size="sm"
        width="180px"
        aria-label={t('rooms.filters.roomType')}
        value={filters.roomTypeId}
        onChange={(event) => onChange({ ...filters, roomTypeId: event.target.value })}
      >
        <option value="">{t('rooms.filters.allTypes')}</option>
        {roomTypes?.map((roomType) => (
          <option key={roomType.id} value={roomType.id}>
            {roomType.name}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="150px"
        aria-label={t('rooms.filters.occupancy')}
        value={filters.occupancy}
        onChange={(event) => onChange({ ...filters, occupancy: event.target.value })}
      >
        <option value="">{t('rooms.filters.occupancy')}</option>
        <option value="VACANT">{t('rooms.filters.vacant')}</option>
        <option value="OCCUPIED">{t('rooms.filters.occupied')}</option>
      </Select>
      <Select
        size="sm"
        width="140px"
        aria-label={t('rooms.filters.floor')}
        value={filters.floor}
        onChange={(event) => onChange({ ...filters, floor: event.target.value })}
      >
        <option value="">{t('rooms.filters.allFloors')}</option>
        {facets?.floors.map((floor) => (
          <option key={floor} value={floor}>
            {t('rooms.filters.floorOption', { floor })}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="160px"
        aria-label={t('rooms.filters.building')}
        value={filters.building}
        onChange={(event) => onChange({ ...filters, building: event.target.value })}
      >
        <option value="">{t('rooms.filters.allBuildings')}</option>
        {facets?.buildings.map((building) => (
          <option key={building} value={building}>
            {building}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="160px"
        aria-label={t('rooms.filters.minCapacity')}
        value={filters.minCapacity}
        onChange={(event) => onChange({ ...filters, minCapacity: event.target.value })}
      >
        <option value="">{t('rooms.filters.capacity')}</option>
        {[1, 2, 3, 4, 5, 6].map((capacity) => (
          <option key={capacity} value={capacity}>
            {t('rooms.filters.capacityOption', { count: capacity })}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="170px"
        aria-label={t('rooms.filters.operationalState')}
        value={filters.operationalState}
        onChange={(event) => onChange({ ...filters, operationalState: event.target.value })}
      >
        <option value="">{t('rooms.filters.operationalState')}</option>
        <option value="AVAILABLE">{t('rooms.filters.available')}</option>
        <option value="OUT_OF_ORDER">{t('rooms.filters.outOfOrder')}</option>
        <option value="OUT_OF_SERVICE">{t('rooms.filters.outOfService')}</option>
      </Select>
      <Select
        size="sm"
        width="170px"
        aria-label={t('rooms.filters.housekeeping')}
        value={filters.housekeepingState}
        onChange={(event) => onChange({ ...filters, housekeepingState: event.target.value })}
      >
        <option value="">{t('rooms.filters.housekeeping')}</option>
        <option value="DIRTY">{t('rooms.filters.dirty')}</option>
        <option value="CLEANING">{t('rooms.filters.cleaning')}</option>
        <option value="CLEAN">{t('rooms.filters.clean')}</option>
        <option value="INSPECTED">{t('rooms.filters.inspected')}</option>
      </Select>
    </>
  );
}
