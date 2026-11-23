'use client';

import { Select } from '@chakra-ui/react';
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
  return (
    <>
      <Select
        size="sm"
        width="180px"
        aria-label="Tipo de habitación"
        value={filters.roomTypeId}
        onChange={(event) => onChange({ ...filters, roomTypeId: event.target.value })}
      >
        <option value="">Todos los tipos</option>
        {roomTypes?.map((roomType) => (
          <option key={roomType.id} value={roomType.id}>
            {roomType.name}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="150px"
        aria-label="Ocupación"
        value={filters.occupancy}
        onChange={(event) => onChange({ ...filters, occupancy: event.target.value })}
      >
        <option value="">Ocupación</option>
        <option value="VACANT">Libre</option>
        <option value="OCCUPIED">Ocupada</option>
      </Select>
      <Select
        size="sm"
        width="140px"
        aria-label="Piso"
        value={filters.floor}
        onChange={(event) => onChange({ ...filters, floor: event.target.value })}
      >
        <option value="">Todos los pisos</option>
        {facets?.floors.map((floor) => (
          <option key={floor} value={floor}>
            Piso {floor}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="160px"
        aria-label="Ala o edificio"
        value={filters.building}
        onChange={(event) => onChange({ ...filters, building: event.target.value })}
      >
        <option value="">Todas las alas</option>
        {facets?.buildings.map((building) => (
          <option key={building} value={building}>
            {building}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="160px"
        aria-label="Capacidad mínima"
        value={filters.minCapacity}
        onChange={(event) => onChange({ ...filters, minCapacity: event.target.value })}
      >
        <option value="">Capacidad</option>
        {[1, 2, 3, 4, 5, 6].map((capacity) => (
          <option key={capacity} value={capacity}>
            {capacity}+ personas
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        width="170px"
        aria-label="Estado operativo"
        value={filters.operationalState}
        onChange={(event) => onChange({ ...filters, operationalState: event.target.value })}
      >
        <option value="">Estado operativo</option>
        <option value="AVAILABLE">Disponible</option>
        <option value="OUT_OF_ORDER">Fuera de orden</option>
        <option value="OUT_OF_SERVICE">Fuera de servicio</option>
      </Select>
      <Select
        size="sm"
        width="170px"
        aria-label="Housekeeping"
        value={filters.housekeepingState}
        onChange={(event) => onChange({ ...filters, housekeepingState: event.target.value })}
      >
        <option value="">Housekeeping</option>
        <option value="DIRTY">Sucia</option>
        <option value="CLEANING">En limpieza</option>
        <option value="CLEAN">Limpia</option>
        <option value="INSPECTED">Inspeccionada</option>
      </Select>
    </>
  );
}
