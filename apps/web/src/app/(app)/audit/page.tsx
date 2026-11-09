'use client';

import {
  Badge,
  Button,
  Code,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { formatDateTime, formatJson } from '@/lib/format';
import type { AuditEvent } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

function AuditContent() {
  const { tenant } = useSession();
  const metadataModal = useDisclosure();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [inputs, setInputs] = useState({ action: '', entityType: '' });
  const [filters, setFilters] = useState({ action: '', entityType: '' });

  const { data, loading, error, reload } = useAsyncData<{ items: AuditEvent[] }>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.action !== '') params.set('action', filters.action.trim().toUpperCase());
      if (filters.entityType !== '') params.set('entityType', filters.entityType.trim());
      return api<{ items: AuditEvent[] }>(`/api/v1/audit-events?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:audit:${JSON.stringify(filters)}`,
  );

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Eventos append-only de la propiedad, ordenados por fecha descendente. Requiere audit.read."
      />

      <SectionCard>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ action: inputs.action, entityType: inputs.entityType });
          }}
        >
          <HStack wrap="wrap" spacing={2} mb={4}>
            <Input
              size="sm"
              width="240px"
              placeholder="Acción exacta, ej. RESERVATION_CREATED"
              value={inputs.action}
              onChange={(event) => setInputs({ ...inputs, action: event.target.value })}
            />
            <Input
              size="sm"
              width="200px"
              placeholder="Tipo de entidad, ej. Reservation"
              value={inputs.entityType}
              onChange={(event) => setInputs({ ...inputs, entityType: event.target.value })}
            />
            <Button size="sm" type="submit" variant="outline">
              Filtrar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setInputs({ action: '', entityType: '' });
                setFilters({ action: '', entityType: '' });
              }}
            >
              Limpiar
            </Button>
            <Text fontSize="xs" color="gray.500" ml="auto">
              {data?.items.length ?? 0} eventos
            </Text>
          </HStack>
        </form>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText="No hay eventos de auditoría para los filtros."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Acción</Th>
                  <Th>Entidad</Th>
                  <Th>Actor</Th>
                  <Th>Correlación</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.items.map((event) => (
                  <Tr key={event.id}>
                    <Td whiteSpace="nowrap">
                      <Text fontSize="xs">{formatDateTime(event.occurredAt)}</Text>
                    </Td>
                    <Td>
                      <Text as="code" fontSize="xs" fontWeight="semibold">
                        {event.action}
                      </Text>
                      {event.reason !== null && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="280px">
                          {event.reason}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme="brand" textTransform="none">
                        {event.entityType}
                      </Badge>
                      <Text fontFamily="mono" fontSize="xs" color="gray.500">
                        {event.entityId.slice(0, 8)}…
                      </Text>
                    </Td>
                    <Td>
                      <Text fontFamily="mono" fontSize="xs">
                        {event.actorUserId !== null
                          ? `${event.actorUserId.slice(0, 8)}…`
                          : 'sistema'}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontFamily="mono" fontSize="xs" color="gray.500">
                        {event.correlationId !== null ? `${event.correlationId.slice(0, 8)}…` : '—'}
                      </Text>
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setSelected(event);
                          metadataModal.onOpen();
                        }}
                      >
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

      <Modal isOpen={metadataModal.isOpen} onClose={metadataModal.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Evento de auditoría</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selected !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm" fontWeight="semibold">
                  {selected.action}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {selected.entityType} · {selected.entityId}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {formatDateTime(selected.occurredAt)} · actor {selected.actorUserId ?? 'sistema'}{' '}
                  · correlación {selected.correlationId ?? '—'}
                </Text>
                {selected.reason !== null && <Text fontSize="sm">Motivo: {selected.reason}</Text>}
                <Code display="block" whiteSpace="pre-wrap" p={3} borderRadius="md" fontSize="xs">
                  {formatJson(selected.metadata)}
                </Code>
              </Stack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function AuditPage() {
  return (
    <PropertyGate>
      <AuditContent />
    </PropertyGate>
  );
}
