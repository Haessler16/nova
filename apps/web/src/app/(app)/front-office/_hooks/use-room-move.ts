'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { RoomMoveCandidates, Stay } from '@/lib/types';
import { buildErrors, hasErrors, reasonField, type FieldErrors } from '@/lib/validation';
import {
  EMPTY_MOVE_FILTERS,
  filterMoveCandidates,
  moveFilterOptions,
  type MoveFilters,
  type MoveResult,
  type Tenant,
} from '../_lib/front-office.types';
import { fetchMoveCandidates, submitRoomMove } from '../_lib/room-move-api';

function useMoveCandidates(tenant: Tenant) {
  const [data, setData] = useState<RoomMoveCandidates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestRef = useRef(0);

  async function load(stayId: string, onLoaded?: (payload: RoomMoveCandidates) => void) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMoveCandidates(tenant, stayId);
      if (requestRef.current !== requestId) {
        return;
      }
      setData(payload);
      onLoaded?.(payload);
    } catch (cause) {
      if (requestRef.current === requestId) {
        setError(cause);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  return { data, loading, error, load };
}

export function useRoomMove({
  tenant,
  reloadAll,
  setBusy,
}: {
  tenant: Tenant;
  reloadAll: () => void;
  setBusy: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const candidates = useMoveCandidates(tenant);
  const [target, setTarget] = useState<Stay | null>(null);
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [filters, setFilters] = useState<MoveFilters>(EMPTY_MOVE_FILTERS);
  const [result, setResult] = useState<MoveResult | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  function open(stay: Stay): void {
    setTarget(stay);
    setRoomId('');
    setReason('');
    setErrors({});
    setResult(null);
    setActionError(null);
    setFilters(EMPTY_MOVE_FILTERS);
    modal.onOpen();
    void candidates.load(stay.id, (payload) =>
      setFilters({ ...EMPTY_MOVE_FILTERS, roomTypeId: payload.stay.room.roomType.id }),
    );
  }

  function updateFilter<K extends keyof MoveFilters>(key: K, value: MoveFilters[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
    setRoomId('');
  }

  function selectRoom(id: string): void {
    setRoomId(id);
    setErrors((current) => {
      const next = { ...current };
      delete next['move.roomId'];
      return next;
    });
  }

  async function submit(): Promise<void> {
    if (target === null || result !== null) {
      return;
    }
    const nextErrors = buildErrors([
      ['move.roomId', roomId === '' ? t('frontOffice.move.roomRequired') : null],
      ['move.reason', reasonField(reason, t('frontOffice.move.reasonField'))],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    const current = target;
    setBusy(`move:${current.id}`);
    try {
      const updated = await submitRoomMove(tenant, current.id, roomId, reason.trim());
      setResult({ fromNumber: current.room.number, toNumber: updated.room.number });
      toast({
        title: t('frontOffice.move.success', {
          from: current.room.number,
          to: updated.room.number,
        }),
        status: 'success',
        duration: 6000,
      });
      reloadAll();
    } catch (cause) {
      // The dialog keeps the context and shows the mapped conflict; the
      // candidate list is refreshed so the operator can pick another room.
      setActionError(cause);
      setRoomId('');
      void candidates.load(current.id);
    } finally {
      setBusy(null);
    }
  }

  const rooms = candidates.data?.candidates ?? [];
  const options = moveFilterOptions(rooms);
  const filtered = filterMoveCandidates(rooms, filters);
  const selected = rooms.find((room) => room.id === roomId) ?? null;

  return {
    modal,
    target,
    roomId,
    reason,
    setReason,
    errors,
    filters,
    result,
    actionError,
    data: candidates.data,
    loading: candidates.loading,
    loadError: candidates.error,
    rooms,
    options,
    filtered,
    selected,
    open,
    updateFilter,
    selectRoom,
    submit,
  };
}

export type RoomMoveController = ReturnType<typeof useRoomMove>;
