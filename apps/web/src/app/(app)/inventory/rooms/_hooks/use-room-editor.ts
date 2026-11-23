'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { Room, RoomType } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { hasErrors, validateRoom } from '@/lib/validation';
import {
  EMPTY_ROOM_FORM,
  createRoomBody,
  roomFormFrom,
  updateRoomBody,
  type RoomForm,
} from '../_lib/rooms';

export function useRoomEditor({
  selectedRoomId,
  onSelectRoom,
  roomTypes,
  reload,
  bumpDetail,
}: {
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  roomTypes: RoomType[] | undefined;
  reload: () => void;
  bumpDetail: () => void;
}) {
  const { tenant } = useSession();
  const toast = useToast();
  const createModal = useDisclosure();
  const editModal = useDisclosure();

  const [saving, setSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [createForm, setCreateForm] = useState<RoomForm>(EMPTY_ROOM_FORM);
  const [editForm, setEditForm] = useState<RoomForm>(EMPTY_ROOM_FORM);

  useEffect(() => {
    if (roomTypes !== undefined && createForm.roomTypeId === '' && roomTypes[0] !== undefined) {
      setCreateForm((current) => ({ ...current, roomTypeId: roomTypes[0]!.id }));
    }
  }, [roomTypes, createForm.roomTypeId]);

  function openCreate(): void {
    setCreateErrors({});
    createModal.onOpen();
  }

  function openEdit(room: Room): void {
    onSelectRoom(room.id);
    setEditForm(roomFormFrom(room));
    setEditErrors({});
    editModal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateRoom(createForm);
    setCreateErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<Room>('/api/v1/inventory/rooms', {
        method: 'POST',
        tenant,
        body: createRoomBody(createForm),
      });
      toast({ title: 'Habitación creada', status: 'success' });
      createModal.onClose();
      setCreateForm({
        ...EMPTY_ROOM_FORM,
        roomTypeId: roomTypes?.[0]?.id ?? '',
      });
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo crear la habitación',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    const nextErrors = validateRoom(editForm);
    setEditErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}`, {
        method: 'PATCH',
        tenant,
        body: updateRoomBody(editForm),
      });
      toast({ title: 'Habitación actualizada', status: 'success' });
      editModal.onClose();
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    createModal,
    editModal,
    openCreate,
    openEdit,
    createForm,
    setCreateForm,
    editForm,
    setEditForm,
    createErrors,
    editErrors,
    saving,
    handleCreate,
    handleEdit,
  };
}

export type RoomEditor = ReturnType<typeof useRoomEditor>;
