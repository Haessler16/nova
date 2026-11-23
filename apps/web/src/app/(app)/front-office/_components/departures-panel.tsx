'use client';

import { Box, Button, HStack, Stack, TabPanel, Text } from '@chakra-ui/react';
import { ReservationDocuments } from '@/components/documents-panel';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, Stay } from '@/lib/types';

function DepartureRow({
  stay,
  isHistorical,
  busy,
  onCheckOut,
  onIncident,
}: {
  stay: Stay;
  isHistorical: boolean;
  busy: string | null;
  onCheckOut: (stay: Stay) => void;
  onIncident: (stay: Stay) => void;
}) {
  const { t } = useI18n();
  return (
    <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            {t('frontOffice.stay.card', {
              number: stay.room.number,
              name: stay.guest.fullName,
            })}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {stay.reservation.code} ·{' '}
            {t('frontOffice.stay.checkout', {
              date: formatCalendarDate(stay.reservation.checkOutDate),
            })}{' '}
            · check-in {formatDateTime(stay.checkedInAt)}
            {stay.checkedOutAt !== null
              ? ` · ${t('frontOffice.stay.checkedOut', {
                  time: formatDateTime(stay.checkedOutAt),
                })}`
              : ''}
          </Text>
        </Box>
        {isHistorical ? (
          <StatusBadge color="sky" label="Check-out" />
        ) : (
          <HStack spacing={1} wrap="wrap">
            <ReservationDocuments
              reservationId={stay.reservation.id}
              reservationCode={stay.reservation.code}
            />
            <Button
              size="xs"
              colorScheme="brand"
              onClick={() => onCheckOut(stay)}
              isLoading={busy === `check-out:${stay.id}`}
            >
              {t('frontOffice.action.checkOut')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onIncident(stay)}>
              {t('frontOffice.action.incident')}
            </Button>
          </HStack>
        )}
      </HStack>
    </Box>
  );
}

export function DeparturesPanel({
  data,
  busy,
  onCheckOut,
  onIncident,
}: {
  data: FrontOfficeOverview;
  busy: string | null;
  onCheckOut: (stay: Stay) => void;
  onIncident: (stay: Stay) => void;
}) {
  const { t } = useI18n();
  return (
    <TabPanel px={0}>
      <SectionCard>
        <Text fontWeight="semibold" mb={1}>
          {t(
            data.isHistorical
              ? 'frontOffice.departures.titleHistorical'
              : 'frontOffice.departures.titleOperational',
          )}
        </Text>
        <Text fontSize="xs" color="gray.500" mb={3}>
          {t(
            data.isHistorical
              ? 'frontOffice.departures.helpHistorical'
              : 'frontOffice.departures.helpOperational',
          )}
        </Text>
        <QueryFeedback
          loading={false}
          error={null}
          isEmpty={data.departures.length === 0}
          emptyText={
            data.isHistorical
              ? t('frontOffice.departures.emptyHistorical')
              : t('frontOffice.departures.emptyOperational')
          }
        >
          <Stack spacing={2}>
            {data.departures.map((stay) => (
              <DepartureRow
                key={stay.id}
                stay={stay}
                isHistorical={data.isHistorical}
                busy={busy}
                onCheckOut={onCheckOut}
                onIncident={onIncident}
              />
            ))}
          </Stack>
        </QueryFeedback>
      </SectionCard>
    </TabPanel>
  );
}
