'use client';

import {
  Badge,
  Button,
  HStack,
  Input,
  Select,
  Table,
  TableContainer,
  TabPanel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { QueryFeedback, SectionCard } from '@/components/ui';
import { SEVERITY_COLORS, formatDateTime } from '@/lib/format';
import type { SecurityEvent } from '@/lib/types';
import type { AdminData } from '../_hooks/use-admin-data';

export function AdminSecurityPanel({
  data,
  onSelect,
}: {
  data: AdminData;
  onSelect: (event: SecurityEvent) => void;
}) {
  const { securityEvents, severityFilter, setSeverityFilter, typeFilter, setTypeFilter } = data;

  return (
    <TabPanel px={0}>
      <SectionCard>
        <HStack wrap="wrap" spacing={2} mb={4}>
          <Select
            size="sm"
            width="180px"
            aria-label="Severidad"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="">Todas las severidades</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </Select>
          <Input
            size="sm"
            width="260px"
            placeholder="Tipo exacto, ej. auth.login_failed"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          />
          <Button size="sm" variant="outline" onClick={securityEvents.reload}>
            Actualizar
          </Button>
          <Text fontSize="xs" color="gray.500" ml="auto">
            {securityEvents.data?.items.length ?? 0} eventos
          </Text>
        </HStack>
        <QueryFeedback
          loading={securityEvents.loading}
          error={securityEvents.error}
          onRetry={securityEvents.reload}
          isEmpty={(securityEvents.data?.items.length ?? 0) === 0}
          emptyText="No hay eventos de seguridad."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Severidad</Th>
                  <Th>Tipo</Th>
                  <Th>Usuario</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {securityEvents.data?.items.map((event) => (
                  <Tr key={event.id}>
                    <Td whiteSpace="nowrap">
                      <Text fontSize="xs">{formatDateTime(event.occurredAt)}</Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={SEVERITY_COLORS[event.severity] ?? 'gray'}>
                        {event.severity}
                      </Badge>
                    </Td>
                    <Td>
                      <Text as="code" fontSize="xs">
                        {event.type}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontFamily="mono" fontSize="xs">
                        {event.userId ?? '—'}
                      </Text>
                    </Td>
                    <Td>
                      <Button size="xs" variant="ghost" onClick={() => onSelect(event)}>
                        Detalle
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>
    </TabPanel>
  );
}
