import { api } from '@/lib/api';
import type { RoomMoveCandidates, Stay } from '@/lib/types';
import type { Tenant } from './front-office.types';

export function fetchMoveCandidates(tenant: Tenant, stayId: string): Promise<RoomMoveCandidates> {
  return api<RoomMoveCandidates>(`/api/v1/front-office/stays/${stayId}/room-move-candidates`, {
    tenant,
  });
}

export function submitRoomMove(
  tenant: Tenant,
  stayId: string,
  roomId: string,
  reason: string,
): Promise<Stay> {
  return api<Stay>(`/api/v1/front-office/stays/${stayId}/room-move`, {
    method: 'POST',
    tenant,
    body: { roomId, reason },
  });
}
