'use client';

import { Button, useDisclosure } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { addDaysISO, todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation, Room } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { CalendarDetailModal } from './_components/calendar-detail-modal';
import { CalendarGrid } from './_components/calendar-grid';
import { CalendarToolbar } from './_components/calendar-toolbar';
import { CalendarUnassigned } from './_components/calendar-unassigned';

function CalendarContent() {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const propertyTimezone = property?.timezone;
  const [startDate, setStartDate] = useState(todayISO(0, propertyTimezone));
  const [days, setDays] = useState(14);
  const detail = useDisclosure();
  const [selected, setSelected] = useState<Reservation | null>(null);

  const endDate = addDaysISO(startDate, days);
  const dates = Array.from({ length: days }, (_, index) => addDaysISO(startDate, index));
  const today = todayISO(0, propertyTimezone);

  const { data, loading, error, reload } = useAsyncData<{
    rooms: Room[];
    reservations: Reservation[];
  }>(async () => {
    const [rooms, reservations] = await Promise.all([
      api<{ items: Room[] }>('/api/v1/inventory/rooms?status=ACTIVE&limit=100', { tenant }),
      api<{ items: Reservation[] }>(
        `/api/v1/reservations?fromDate=${startDate}&toDate=${endDate}&limit=100`,
        { tenant },
      ),
    ]);
    return {
      rooms: rooms.items,
      reservations: reservations.items.filter((reservation) => reservation.status !== 'CANCELLED'),
    };
  }, `${tenant.organizationId}:${tenant.propertyId}:calendar:${startDate}:${days}`);

  const assigned = data?.reservations.filter((reservation) => reservation.room !== null) ?? [];
  const unassigned =
    data?.reservations.filter(
      (reservation) => reservation.room === null && reservation.status !== 'NO_SHOW',
    ) ?? [];

  function openDetail(reservation: Reservation): void {
    setSelected(reservation);
    detail.onOpen();
  }

  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        description={t('calendar.description')}
        actions={
          <Button as={NextLink} href="/reservations" size="sm" colorScheme="brand">
            {t('calendar.newReservation')}
          </Button>
        }
      />

      <SectionCard p={0} overflow="hidden">
        <CalendarToolbar
          startDate={startDate}
          onStartDateChange={setStartDate}
          days={days}
          onDaysChange={setDays}
          today={today}
          assignedCount={assigned.length}
          unassignedCount={unassigned.length}
          hasData={data !== null}
        />

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.rooms.length ?? 0) === 0}
          emptyText={t('calendar.empty')}
        >
          {data !== null && (
            <CalendarGrid
              rooms={data.rooms}
              assigned={assigned}
              dates={dates}
              startDate={startDate}
              days={days}
              today={today}
              onSelect={openDetail}
            />
          )}
        </QueryFeedback>
      </SectionCard>

      <CalendarUnassigned reservations={unassigned} />

      <CalendarDetailModal
        reservation={selected}
        isOpen={detail.isOpen}
        onClose={detail.onClose}
      />
    </>
  );
}

export default function CalendarPage() {
  return (
    <PropertyGate>
      <CalendarContent />
    </PropertyGate>
  );
}
