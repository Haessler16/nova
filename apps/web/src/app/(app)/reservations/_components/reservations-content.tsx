'use client';

import { useState } from 'react';
import { QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import type { Guest, Reservation } from '@/lib/types';
import { useCreateReservation } from '../_hooks/use-create-reservation';
import { useReservationDeepLink } from '../_hooks/use-reservation-deep-link';
import { useGuestEdit } from '../_hooks/use-guest-edit';
import { useReservationCancel } from '../_hooks/use-reservation-cancel';
import { useReservationDetail } from '../_hooks/use-reservation-detail';
import { useReservationEdit } from '../_hooks/use-reservation-edit';
import { useReservationList } from '../_hooks/use-reservation-list';
import { useReservationRoomActions } from '../_hooks/use-reservation-room-actions';
import { CancelReservationDialog } from './cancel-reservation-dialog';
import { CreateReservationModal } from './create-reservation-modal';
import { EditReservationModal } from './edit-reservation-modal';
import { GuestEditModal } from './guest-edit-modal';
import { ReservationDetailDrawer } from './reservation-detail-drawer';
import { ReservationsFilters } from './reservations-filters';
import { ReservationsHeader } from './reservations-header';
import { ReservationsTable } from './reservations-table';

export function ReservationsContent() {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const propertyTimezone = property?.timezone;
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  const list = useReservationList(tenant, propertyTimezone);
  const detail = useReservationDetail(tenant, propertyTimezone);
  const create = useCreateReservation({
    tenant,
    propertyTimezone,
    onReload: () => list.reload(),
    onOpenDetail: openDetail,
  });
  const edit = useReservationEdit({
    tenant,
    selectedId: detail.selectedId,
    onSelect: (reservation) => detail.setSelectedId(reservation.id),
    onSaved: () => {
      list.reload();
      detail.bumpDetail();
    },
  });
  const roomActions = useReservationRoomActions({
    tenant,
    selectedId: detail.selectedId,
    onChanged: () => {
      list.reload();
      detail.bumpDetail();
    },
  });
  const cancel = useReservationCancel({
    selectedId: detail.selectedId,
    onSelect: (reservation) => detail.setSelectedId(reservation.id),
    onCancelled: () => {
      list.reload();
      detail.bumpDetail();
    },
  });
  const guestEdit = useGuestEdit({
    tenant,
    onSelectedUpdated: (guest) => {
      // Only the guest chosen in the create form can be replaced by an edit that
      // started from there.
      if (selectedGuest?.id === guest.id) {
        setSelectedGuest(guest);
      }
    },
    onSaved: (source) => {
      if (source === 'detail') {
        detail.bumpDetail();
      }
      list.reload();
    },
  });

  function openDetail(reservation: Reservation): void {
    roomActions.reset();
    detail.openDetail(reservation);
  }

  function openCreate(): void {
    setSelectedGuest(null);
    create.open();
  }

  function pickGuest(guest: Guest): void {
    setSelectedGuest(guest);
    create.setForm((current) => ({ ...current, guestId: guest.id }));
  }

  function clearGuest(): void {
    setSelectedGuest(null);
    create.setForm((current) => ({ ...current, guestId: '' }));
  }

  useReservationDeepLink({ tenant, list, openCreate, openDetail });

  return (
    <>
      <ReservationsHeader
        exporting={list.exporting}
        onExport={() => void list.exportReservations()}
        onNew={openCreate}
      />

      <SectionCard>
        <ReservationsFilters list={list} />
        <QueryFeedback
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          isEmpty={(list.data?.items.length ?? 0) === 0}
          emptyText={t('reservations.empty')}
        >
          <ReservationsTable
            rows={list.data?.items ?? []}
            onOpenDetail={openDetail}
            onEdit={edit.open}
            onCancel={cancel.open}
          />
        </QueryFeedback>
      </SectionCard>

      <CreateReservationModal
        tenant={tenant}
        create={create}
        selectedGuest={selectedGuest}
        onSelectGuest={pickGuest}
        onClearGuest={clearGuest}
        onEditGuest={(guest) => guestEdit.open(guest, 'create')}
      />
      <EditReservationModal edit={edit} />
      <CancelReservationDialog
        cancel={cancel}
        reservation={detail.selectedReservation}
        today={detail.today}
      />
      <GuestEditModal edit={guestEdit} />
      <ReservationDetailDrawer
        detail={detail}
        roomActions={roomActions}
        onEditGuest={(guest) => guestEdit.open(guest, 'detail')}
      />
    </>
  );
}
