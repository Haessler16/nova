'use client';

import { Box, Button, HStack, Input, Select, Stack, Text, Textarea } from '@chakra-ui/react';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
} from '@/lib/format';
import type { IncidentSeverity, IncidentType } from '@/lib/types';
import type { RoomIncidents } from '../_hooks/use-room-incidents';

export function RoomIncidentForm({ incidents }: { incidents: RoomIncidents }) {
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
        Registrar incidencia
      </Text>
      <Stack spacing={2}>
        <HStack>
          <Select
            size="sm"
            aria-label="Tipo de incidencia"
            value={form.type}
            onChange={(event) =>
              setForm({
                ...form,
                type: event.target.value as IncidentType,
              })
            }
          >
            {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            size="sm"
            aria-label="Severidad de la incidencia"
            value={form.severity}
            onChange={(event) =>
              setForm({
                ...form,
                severity: event.target.value as IncidentSeverity,
              })
            }
          >
            {Object.entries(INCIDENT_SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </HStack>
        <Input
          size="sm"
          placeholder="Título (3–120)"
          maxLength={120}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
        <Textarea
          rows={3}
          placeholder="Descripción (3–4000), sin datos sensibles"
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
          Registrar
        </Button>
      </Stack>
    </Box>
  );
}
