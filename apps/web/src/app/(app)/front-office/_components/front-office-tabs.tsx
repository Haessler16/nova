'use client';

import { SimpleGrid, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, Incident, Reservation, RoomRackItem, Stay } from '@/lib/types';
import type { IncidentListController } from '../_hooks/use-incidents';
import { ArrivalsPanel } from './arrivals-panel';
import { DeparturesPanel } from './departures-panel';
import { IncidentsPanel } from './incidents-panel';
import { RoomRackPanel } from './room-rack-panel';
import { StayCard } from './stay-card';
import { QueryFeedback, SectionCard } from '@/components/ui';

export function FrontOfficeTabs({
  data,
  inHouse,
  busy,
  tabIndex,
  onTabChange,
  incidents,
  onCheckIn,
  onNoShow,
  onCheckOut,
  onMove,
  onIncident,
  onCreateIncident,
  onResolveIncident,
}: {
  data: FrontOfficeOverview;
  inHouse: Stay[];
  busy: string | null;
  tabIndex: number;
  onTabChange: (index: number) => void;
  incidents: IncidentListController;
  onCheckIn: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
  onCheckOut: (stay: Stay) => void;
  onMove: (stay: Stay) => void;
  onIncident: (stay?: Stay, room?: RoomRackItem) => void;
  onCreateIncident: () => void;
  onResolveIncident: (incident: Incident) => void;
}) {
  const { t } = useI18n();

  return (
    <Tabs colorScheme="brand" index={tabIndex} onChange={onTabChange} isLazy>
      <TabList>
        <Tab>
          {t('frontOffice.tab.arrivals')} ({data.counts.arrivals})
        </Tab>
        <Tab>
          {t(data.isHistorical ? 'frontOffice.tab.hosted' : 'frontOffice.tab.inHouse')} (
          {data.counts.inHouse})
        </Tab>
        <Tab>
          {t('frontOffice.tab.departures')} ({data.counts.departures})
        </Tab>
        {!data.isHistorical && (
          <Tab>
            {t('frontOffice.tab.rack')} ({data.roomRack.length})
          </Tab>
        )}
        {!data.isHistorical && <Tab>{t('frontOffice.tab.incidents')}</Tab>}
      </TabList>

      <TabPanels>
        <ArrivalsPanel data={data} busy={busy} onCheckIn={onCheckIn} onNoShow={onNoShow} />
        <TabPanel px={0}>
          <SectionCard>
            <Text fontWeight="semibold" mb={1}>
              {t(
                data.isHistorical
                  ? 'frontOffice.inHouse.titleHistorical'
                  : 'frontOffice.inHouse.titleOperational',
              )}
            </Text>
            <Text fontSize="xs" color="gray.500" mb={3}>
              {t(
                data.isHistorical
                  ? 'frontOffice.inHouse.helpHistorical'
                  : 'frontOffice.inHouse.helpOperational',
              )}
            </Text>
            <QueryFeedback
              loading={false}
              error={null}
              isEmpty={inHouse.length === 0}
              emptyText={
                data.isHistorical
                  ? t('frontOffice.inHouse.emptyHistorical')
                  : t('frontOffice.inHouse.emptyOperational')
              }
            >
              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={2}>
                {inHouse.map((stay) => (
                  <StayCard
                    key={stay.id}
                    stay={stay}
                    busy={busy}
                    readOnly={data.isHistorical}
                    onCheckOut={onCheckOut}
                    onMove={onMove}
                    onIncident={onIncident}
                  />
                ))}
              </SimpleGrid>
            </QueryFeedback>
          </SectionCard>
        </TabPanel>
        <DeparturesPanel data={data} busy={busy} onCheckOut={onCheckOut} onIncident={onIncident} />
        <RoomRackPanel data={data} inHouse={inHouse} onIncident={onIncident} />
        <IncidentsPanel list={incidents} onResolve={onResolveIncident} onCreate={onCreateIncident} />
      </TabPanels>
    </Tabs>
  );
}
