import type { FrontOfficeOverview } from '@/lib/types';

export function deriveOverviewMetrics(
  overviewData: FrontOfficeOverview | null | undefined,
): {
  totalRooms: number;
  occupancy: number | null;
  readyRooms: number;
} {
  const totalRooms =
    (overviewData?.counts.occupiedRooms ?? 0) + (overviewData?.counts.vacantRooms ?? 0);
  const occupancy =
    totalRooms > 0
      ? Math.round(((overviewData?.counts.occupiedRooms ?? 0) / totalRooms) * 100)
      : null;
  const readyRooms =
    overviewData?.roomRack.filter(
      (room) =>
        room.occupancy === 'VACANT' &&
        room.operationalState === 'AVAILABLE' &&
        (room.housekeepingState === 'CLEAN' || room.housekeepingState === 'INSPECTED'),
    ).length ?? 0;

  return { totalRooms, occupancy, readyRooms };
}
