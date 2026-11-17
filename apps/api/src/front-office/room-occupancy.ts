/**
 * Occupancy read models (check-in readiness and room-move candidates) share
 * one rule: a room with an in-house stay must report that fact once. The
 * occupying stay's own reservation also overlaps the target dates, so without
 * this filter the read model answers `ROOM_OCCUPIED`/`room_occupied` plus
 * `ROOM_NOT_AVAILABLE`/`room_not_available` for the same reservation while the
 * transactional check-in and room move return only the occupied code.
 *
 * A different overlapping reservation on an occupied room is still reported:
 * the deduplication is per occupying reservation, not a blanket suppression.
 */
export function groupOccupyingReservations(
  occupants: ReadonlyArray<{ roomId: string; reservationId: string }>,
): Map<string, Set<string>> {
  const byRoom = new Map<string, Set<string>>();
  for (const occupant of occupants) {
    const reservations = byRoom.get(occupant.roomId) ?? new Set<string>();
    reservations.add(occupant.reservationId);
    byRoom.set(occupant.roomId, reservations);
  }
  return byRoom;
}

export function occupiedRoomIds(
  occupyingReservations: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  return new Set(occupyingReservations.keys());
}

export function overlappingRoomIds(
  overlapping: ReadonlyArray<{ id: string; roomId: string | null }>,
  occupyingReservations: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const rooms = new Set<string>();
  for (const row of overlapping) {
    if (row.roomId === null) {
      continue;
    }
    if (occupyingReservations.get(row.roomId)?.has(row.id) === true) {
      continue;
    }
    rooms.add(row.roomId);
  }
  return rooms;
}
