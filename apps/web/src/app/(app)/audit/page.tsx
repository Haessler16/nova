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
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { ErrorAlert, PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useAuditFeedStore } from '@/stores/audit-feed';
import { formatDateTime, formatJson } from '@/lib/format';
import type { AuditEvent } from '@/lib/types';

interface AuditFilters {
  action: string;
  entityType: string;
  actorUserId: string;
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTERS: AuditFilters = {
  action: '',
  entityType: '',
  actorUserId: '',
  fromDate: '',
  toDate: '',
};

function AuditContent() {
  const { tenant } = useSession();
  const organizationId = tenant.organizationId;
  const propertyId = tenant.propertyId;
  const metadataModal = useDisclosure();

  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [inputs, setInputs] = useState<AuditFilters>(EMPTY_FILTERS);

  const tenantKey = `${organizationId}:${propertyId}`;
  const filters = useAuditFeedStore((state) => state.filters);
  const feedTenantKey = useAuditFeedStore((state) => state.tenantKey);
  const storedItems = useAuditFeedStore((state) => state.items);
  const storedNextCursor = useAuditFeedStore((state) => state.nextCursor);
  const storedLoading = useAuditFeedStore((state) => state.loading);
  const storedLoadingMore = useAuditFeedStore((state) => state.loadingMore);
  const storedError = useAuditFeedStore((state) => state.error);
  const storedMoreError = useAuditFeedStore((state) => state.moreError);
  const load = useAuditFeedStore((state) => state.load);
  const loadMore = useAuditFeedStore((state) => state.loadMore);
  const setFilters = useAuditFeedStore((state) => state.setFilters);

  // Never render the previous property's feed while the new load starts.
  const tenantMatches = feedTenantKey === tenantKey;
  const items = tenantMatches ? storedItems : [];
  const nextCursor = tenantMatches ? storedNextCursor : null;
  const loading = tenantMatches ? storedLoading : true;
  const loadingMore = tenantMatches ? storedLoadingMore : false;
  const error = tenantMatches ? storedError : null;
  const moreError = tenantMatches ? storedMoreError : null;

  useEffect(() => {
    void load({
      tenantKey,
      tenant: { organizationId, propertyId },
      filters,
    });
  }, [load, tenantKey, organizationId, propertyId, filters]);

  function applyFilters(event: FormEvent): void {
    event.preventDefault();
    setFilters({ ...inputs });
  }

  function resetFilters(): void {
    setInputs({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
  }

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Eventos append-only de la propiedad, ordenados por fecha descendente. Filtrable por acción, entidad, actor y rango de fechas para soporte y conciliación. El rango usa la zona horaria de la propiedad e incluye ambos días."
      />

      <SectionCard>
        <form onSubmit={applyFilters}>
          <HStack wrap="wrap" spacing={2} mb={4} align="flex-end">
            <Input
              size="sm"
              width="230px"
              placeholder="Acción, ej. reservation.created"
              aria-label="Filtrar por acción"
              value={inputs.action}
              onChange={(event) => setInputs({ ...inputs, action: event.target.value })}
            />
            <Input
              size="sm"
              width="190px"
              placeholder="Entidad, ej. Reservation"
              aria-label="Filtrar por tipo de entidad"
              value={inputs.entityType}
              onChange={(event) => setInputs({ ...inputs, entityType: event.target.value })}
            />
            <Input
              size="sm"
              width="250px"
              placeholder="Actor (UUID)"
              aria-label="Filtrar por actor"
              value={inputs.actorUserId}
              onChange={(event) => setInputs({ ...inputs, actorUserId: event.target.value })}
            />
            <HStack spacing={1}>
              <Text fontSize="xs" color="textSecondary">
                Desde
              </Text>
              <Input
                size="sm"
                type="date"
                width="150px"
                aria-label="Fecha desde"
                value={inputs.fromDate}
                onChange={(event) => setInputs({ ...inputs, fromDate: event.target.value })}
              />
              <Text fontSize="xs" color="textSecondary">
                Hasta
              </Text>
              <Input
                size="sm"
                type="date"
                width="150px"
                aria-label="Fecha hasta"
                value={inputs.toDate}
                onChange={(event) => setInputs({ ...inputs, toDate: event.target.value })}
              />
            </HStack>
            <Button size="sm" type="submit" variant="outline">
              Filtrar
            </Button>
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              Limpiar
            </Button>
            <Text fontSize="xs" color="textSecondary" ml="auto">
              {items.length} eventos
            </Text>
          </HStack>
        </form>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={() => void load({ tenantKey, tenant: { organizationId, propertyId }, filters })}
          isEmpty={items.length === 0}
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
                {items.map((event) => (
                  <Tr key={event.id}>
                    <Td whiteSpace="nowrap">
                      <Text fontSize="xs">{formatDateTime(event.occurredAt)}</Text>
                    </Td>
                    <Td>
                      <Text as="code" fontSize="xs" fontWeight="semibold">
                        {event.action}
                      </Text>
                      {event.reason !== null && (
                        <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="280px">
                          {event.reason}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme="brand" textTransform="none">
                        {event.entityType}
                      </Badge>
                      <Text fontFamily="mono" fontSize="xs" color="textSecondary">
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
                      <Text fontFamily="mono" fontSize="xs" color="textSecondary">
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

          {moreError !== null && (
            <Stack mt={3}>
              <ErrorAlert error={moreError} />
            </Stack>
          )}

          {nextCursor !== null && (
            <HStack justify="center" mt={4}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadMore({ organizationId, propertyId })}
                isLoading={loadingMore}
              >
                Cargar más
              </Button>
            </HStack>
          )}
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
                <Text fontSize="xs" color="textSecondary">
                  {selected.entityType} · {selected.entityId}
                </Text>
                <Text fontSize="xs" color="textSecondary">
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
