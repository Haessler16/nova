'use client';

import { Stack, useDisclosure } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { CheckInWizard } from '@/components/check-in-wizard';
import { QueryFeedback } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, Reservation } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { useBusy } from '../_hooks/use-busy';
import {
  useIncidentCreate,
  useIncidentList,
  useIncidentResolve,
} from '../_hooks/use-incidents';
import { useReservationSearch } from '../_hooks/use-reservation-search';
import { useRoomMove } from '../_hooks/use-room-move';
import { useCheckout, useNoShow } from '../_hooks/use-stay-flows';
import { CheckoutDialog } from './checkout-dialog';
import { FrontOfficeHeader } from './front-office-header';
import { FrontOfficeMetrics } from './front-office-metrics';
import { FrontOfficeSearchForm } from './search-form';
import { FrontOfficeTabs } from './front-office-tabs';
import { HistoricalBanner } from './historical-banner';
import { IncidentDialog } from './incident-dialog';
import { NoShowDialog } from './no-show-dialog';
import { ResolveDialog } from './resolve-dialog';
import { RoomMoveDialog } from './room-move-dialog';
import { SearchResults } from './search-results';

export function FrontOfficeContent() {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const propertyTimezone = property?.timezone;
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [checkInTarget, setCheckInTarget] = useState<Reservation | null>(null);
  const checkInModal = useDisclosure();

  const overview = useAsyncData<FrontOfficeOverview>(
    () =>
      api<FrontOfficeOverview>(
        `/api/v1/front-office/overview${
          selectedDate !== '' ? `?date=${encodeURIComponent(selectedDate)}` : ''
        }`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:front-office:overview:${selectedDate}`,
  );

  const incidentList = useIncidentList(tenant);
  function reloadAll(): void {
    overview.reload();
    incidentList.incidents.reload();
  }

  const { busy, setBusy } = useBusy();
  const search = useReservationSearch(tenant, setTabIndex);
  const checkout = useCheckout({ tenant, reloadAll, setBusy });
  const roomMove = useRoomMove({ tenant, reloadAll, setBusy });
  const noShow = useNoShow({ tenant, reloadAll, setBusy });
  const incidentCreate = useIncidentCreate({ tenant, reloadAll, setBusy });
  const incidentResolve = useIncidentResolve({ tenant, reloadAll, setBusy });

  useEffect(() => {
    if (overview.data?.isHistorical === true && tabIndex > 2) {
      setTabIndex(0);
    }
  }, [overview.data?.isHistorical, tabIndex]);

  function changeDate(next: string): void {
    setSelectedDate(next);
    setTabIndex(0);
  }

  function openGuidedCheckIn(reservation: Reservation): void {
    setCheckInTarget(reservation);
    checkInModal.onOpen();
  }

  const data = overview.data;
  const referenceDate =
    selectedDate !== '' ? selectedDate : (data?.selectedDate ?? todayISO(0, propertyTimezone));
  const inHouse = data?.inHouse ?? [];

  return (
    <>
      <FrontOfficeHeader
        data={data}
        referenceDate={referenceDate}
        propertyTimezone={propertyTimezone}
        reloading={overview.loading}
        onChangeDate={changeDate}
        onReload={reloadAll}
      />
      <FrontOfficeSearchForm
        inputs={search.inputs}
        active={search.active}
        loading={search.loading}
        onChange={search.updateInput}
        onSubmit={search.apply}
        onClear={search.clear}
      />
      <SearchResults search={search} onCheckIn={openGuidedCheckIn} />

      <QueryFeedback
        loading={overview.loading && data === null}
        error={overview.error}
        onRetry={overview.reload}
        isEmpty={data === null}
        emptyText={t('frontOffice.board.loadError')}
      >
        {data !== null && (
          <Stack spacing={5}>
            {data.isHistorical && <HistoricalBanner date={data.selectedDate} />}
            <FrontOfficeMetrics data={data} />
            <FrontOfficeTabs
              data={data}
              inHouse={inHouse}
              busy={busy}
              tabIndex={tabIndex}
              onTabChange={setTabIndex}
              incidents={incidentList}
              onCheckIn={openGuidedCheckIn}
              onNoShow={noShow.open}
              onCheckOut={checkout.open}
              onMove={roomMove.open}
              onIncident={incidentCreate.open}
              onCreateIncident={() => incidentCreate.open()}
              onResolveIncident={incidentResolve.open}
            />
          </Stack>
        )}
      </QueryFeedback>

      <CheckInWizard
        isOpen={checkInModal.isOpen}
        reservation={checkInTarget}
        tenant={tenant}
        onClose={() => {
          checkInModal.onClose();
          setCheckInTarget(null);
        }}
        onCompleted={reloadAll}
      />
      <CheckoutDialog
        checkout={checkout}
        busy={busy}
        fallbackCurrency={property?.currencyCode ?? 'BRL'}
      />
      <RoomMoveDialog move={roomMove} busy={busy} />
      <NoShowDialog noShow={noShow} busy={busy} />
      <IncidentDialog create={incidentCreate} data={data} inHouse={inHouse} busy={busy} />
      <ResolveDialog resolve={incidentResolve} busy={busy} />
    </>
  );
}
