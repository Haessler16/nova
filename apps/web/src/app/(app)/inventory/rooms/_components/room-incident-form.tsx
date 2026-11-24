'use client';

import { Box, Button, HStack, Input, Select, Stack, Text, Textarea } from '@chakra-ui/react';
import { incidentSeverityLabel, incidentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { IncidentSeverity, IncidentType } from '@/lib/types';
import type { RoomIncidents } from '../_hooks/use-room-incidents';

const INCIDENT_TYPES: IncidentType[] = ['NOTE', 'MAINTENANCE', 'COMPLAINT', 'SAFETY', 'OTHER'];
const INCIDENT_SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

export function RoomIncidentForm({ incidents }: { incidents: RoomIncidents }) {
  const { t, locale } = useI18n();
  const { form, setForm } = incidents;

  return (
    <Box
      as="form"
      onSubmit={(event) => void incidents.create(event)}
      borderWidth="1px"
      borderRadius="md"
      p={3}
    >
      <Text fontWeight="semibold" mb={2}>
        {t('rooms.incidents.title')}
      </Text>
      <Stack spacing={2}>
        <HStack>
          <Select
            size="sm"
            aria-label={t('rooms.incidents.type')}
            value={form.type}
            onChange={(event) =>
              setForm({
                ...form,
                type: event.target.value as IncidentType,
              })
            }
          >
            {INCIDENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {incidentTypeLabel(locale, value)}
              </option>
            ))}
          </Select>
          <Select
            size="sm"
            aria-label={t('rooms.incidents.severity')}
            value={form.severity}
            onChange={(event) =>
              setForm({
                ...form,
                severity: event.target.value as IncidentSeverity,
              })
            }
          >
            {INCIDENT_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {incidentSeverityLabel(locale, value)}
              </option>
            ))}
          </Select>
        </HStack>
        <Input
          size="sm"
          placeholder={t('rooms.incidents.titlePlaceholder')}
          maxLength={120}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
        <Textarea
          rows={3}
          placeholder={t('rooms.incidents.descriptionPlaceholder')}
          maxLength={4000}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          required
        />
        <Button
          type="submit"
          size="sm"
          alignSelf="flex-start"
          colorScheme="brand"
          isLoading={incidents.saving}
        >
          {t('rooms.incidents.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
