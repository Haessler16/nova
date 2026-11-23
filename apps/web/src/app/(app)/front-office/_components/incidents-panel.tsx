'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  Select,
  Stack,
  TabPanel,
  Text,
} from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import {
  INCIDENT_SEVERITY_COLORS,
  formatDateTime,
  incidentSeverityLabel,
  incidentStatusLabel,
  incidentTypeLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Incident, IncidentStatus } from '@/lib/types';
import type { IncidentListController } from '../_hooks/use-incidents';

function IncidentRow({
  incident,
  onResolve,
}: {
  incident: Incident;
  onResolve: (incident: Incident) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderLeftWidth="4px"
      borderLeftColor={
        incident.severity === 'HIGH'
          ? 'danger.400'
          : incident.severity === 'MEDIUM'
            ? 'warning.400'
            : 'sky.400'
      }
      px={3}
      py={2}
    >
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" fontWeight="semibold">
              {incident.title}
            </Text>
            <StatusBadge
              color={incident.status === 'OPEN' ? 'warning' : 'mint'}
              label={incidentStatusLabel(locale, incident.status)}
            />
            <StatusBadge
              color={INCIDENT_SEVERITY_COLORS[incident.severity]}
              label={t('frontOffice.incidents.severity', {
                level: incidentSeverityLabel(locale, incident.severity),
              })}
            />
            <Badge colorScheme="gray" textTransform="none">
              {incidentTypeLabel(locale, incident.type)}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500" mt={1}>
            {incident.room !== null
              ? t('frontOffice.rack.room', { number: incident.room.number })
              : t('frontOffice.incidents.noRoom')}
            {incident.reservation !== null ? ` · ${incident.reservation.code}` : ''}
            {' · '}
            {formatDateTime(incident.createdAt)}
            {incident.createdBy !== null ? ` · ${incident.createdBy.name}` : ''}
          </Text>
          <Text fontSize="sm" mt={1} whiteSpace="pre-wrap">
            {incident.description}
          </Text>
          {incident.resolution !== null && (
            <Box mt={1} borderLeftWidth="2px" borderColor="mint.300" pl={2}>
              <Text fontSize="xs" color="gray.500">
                {t('frontOffice.incidents.resolution')}
                {incident.resolvedBy !== null ? ` · ${incident.resolvedBy.name}` : ''}{' '}
                · {formatDateTime(incident.resolvedAt)}
              </Text>
              <Text fontSize="xs">{incident.resolution}</Text>
            </Box>
          )}
        </Box>
        {incident.status === 'OPEN' && (
          <Button size="xs" variant="outline" colorScheme="mint" onClick={() => onResolve(incident)}>
            {t('frontOffice.incidents.resolve')}
          </Button>
        )}
      </HStack>
    </Box>
  );
}

export function IncidentsPanel({
  list,
  onResolve,
  onCreate,
}: {
  list: IncidentListController;
  onResolve: (incident: Incident) => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const { incidents, filter, setFilter } = list;
  return (
    <TabPanel px={0} hidden={false}>
      <SectionCard>
        <HStack justify="space-between" mb={3} wrap="wrap" gap={2}>
          <Box>
            <Text fontWeight="semibold">{t('frontOffice.incidents.title')}</Text>
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.incidents.help')}
            </Text>
          </Box>
          <HStack>
            <Select
              size="sm"
              width="150px"
              aria-label={t('frontOffice.incidents.statusAria')}
              value={filter}
              onChange={(event) => setFilter(event.target.value as IncidentStatus | '')}
            >
              <option value="OPEN">{t('frontOffice.incidents.filterOpen')}</option>
              <option value="RESOLVED">{t('frontOffice.incidents.filterResolved')}</option>
              <option value="">{t('frontOffice.incidents.filterAll')}</option>
            </Select>
            <Button size="sm" colorScheme="brand" onClick={onCreate}>
              {t('frontOffice.incidents.new')}
            </Button>
          </HStack>
        </HStack>
        <QueryFeedback
          loading={incidents.loading}
          error={incidents.error}
          onRetry={incidents.reload}
          isEmpty={(incidents.data?.items.length ?? 0) === 0}
          emptyText={t('frontOffice.incidents.empty')}
        >
          <Stack spacing={2}>
            {incidents.data?.items.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} onResolve={onResolve} />
            ))}
          </Stack>
        </QueryFeedback>
      </SectionCard>
    </TabPanel>
  );
}
