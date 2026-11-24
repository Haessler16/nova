'use client';

import { Button, useDisclosure } from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import type { Room } from '@/lib/types';
import { RoomCreateModal } from './_components/room-create-modal';
import { RoomDetailDrawer } from './_components/room-detail-drawer';
import { RoomEditModal } from './_components/room-edit-modal';
import { RoomsFilterBar } from './_components/rooms-filters';
import { RoomsSummary } from './_components/rooms-summary';
import { RoomsTable } from './_components/rooms-table';
import { useRoomBlocks } from './_hooks/use-room-blocks';
import { useRoomDetail } from './_hooks/use-room-detail';
import { useRoomEditor } from './_hooks/use-room-editor';
import { useRoomHousekeeping } from './_hooks/use-room-housekeeping';
import { useRoomIncidents } from './_hooks/use-room-incidents';
import { useRoomLeases } from './_hooks/use-room-leases';
import { useRoomsList } from './_hooks/use-rooms-list';

function RoomsContent() {
  const { t } = useI18n();
  const { actor } = useSession();
  const rooms = useRoomsList();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoom = rooms.data?.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const drawer = useDisclosure();

  const detail = useRoomDetail(selectedRoomId);
  const editor = useRoomEditor({
    selectedRoomId,
    onSelectRoom: setSelectedRoomId,
    roomTypes: rooms.data?.roomTypes,
    reload: rooms.reload,
    bumpDetail: detail.bumpDetail,
  });
  const housekeeping = useRoomHousekeeping(selectedRoomId, rooms.reload, detail.bumpDetail);
  const blocks = useRoomBlocks(selectedRoomId, rooms.reload, detail.bumpDetail);
  const incidents = useRoomIncidents(selectedRoomId);
  const leases = useRoomLeases(selectedRoom, selectedRoomId, rooms.reloadSilent, detail.bumpDetail);

  function openDetail(room: Room): void {
    setSelectedRoomId(room.id);
    housekeeping.reset();
    incidents.reset();
    blocks.reset();
    drawer.onOpen();
  }

  return (
    <>
      <PageHeader
        title={t('rooms.title')}
        description={t('rooms.description')}
        actions={
          <Button colorScheme="brand" size="sm" onClick={editor.openCreate}>
            {t('rooms.newRoom')}
          </Button>
        }
      />

      <SectionCard>
        <RoomsSummary summary={rooms.data?.summary} />
        <RoomsFilterBar
          searchInput={rooms.searchInput}
          onSearchInput={rooms.setSearchInput}
          onSearch={rooms.applySearch}
          filters={rooms.filters}
          onChange={rooms.setFilters}
          onClear={rooms.clearFilters}
          roomTypes={rooms.data?.roomTypes}
          facets={rooms.data?.facets}
          total={rooms.data?.rooms.length ?? 0}
        />

        <QueryFeedback
          loading={rooms.loading}
          error={rooms.error}
          onRetry={rooms.reload}
          isEmpty={(rooms.data?.rooms.length ?? 0) === 0}
          emptyText={t('rooms.empty')}
        >
          <RoomsTable
            rooms={rooms.data?.rooms ?? []}
            onDetail={openDetail}
            onEdit={editor.openEdit}
          />
        </QueryFeedback>
      </SectionCard>

      <RoomCreateModal
        isOpen={editor.createModal.isOpen}
        onClose={editor.createModal.onClose}
        form={editor.createForm}
        onChange={editor.setCreateForm}
        errors={editor.createErrors}
        saving={editor.saving}
        onSubmit={(event) => void editor.handleCreate(event)}
        roomTypes={rooms.data?.roomTypes}
      />

      <RoomEditModal
        isOpen={editor.editModal.isOpen}
        onClose={editor.editModal.onClose}
        form={editor.editForm}
        onChange={editor.setEditForm}
        errors={editor.editErrors}
        saving={editor.saving}
        onSubmit={(event) => void editor.handleEdit(event)}
        roomTypes={rooms.data?.roomTypes}
      />

      <RoomDetailDrawer
        isOpen={drawer.isOpen}
        onClose={drawer.onClose}
        room={selectedRoom}
        detail={detail.detail}
        housekeeping={housekeeping}
        blocks={blocks}
        incidents={incidents}
        leases={leases}
        actorId={actor?.id}
      />
    </>
  );
}

export default function RoomsPage() {
  return (
    <PropertyGate>
      <RoomsContent />
    </PropertyGate>
  );
}
