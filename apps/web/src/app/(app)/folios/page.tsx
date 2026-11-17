'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DownloadIcon } from '@/components/icons';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { RowActionLink } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import {
  FOLIO_STATUS_COLORS,
  FOLIO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  formatMoney,
  formatDateTime,
  todayISO,
} from '@/lib/format';
import type { Folio, Reservation } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

function FoliosContent() {
  const { tenant, property } = useSession();
  const propertyTimezone = property?.timezone;
  const router = useRouter();
  const toast = useToast();
  const modal = useDisclosure();

  const [filters, setFilters] = useState({ status: '', search: '' });
  const [exporting, setExporting] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const folios = useAsyncData<{ items: Folio[] }>(
    () => {
      const params = new URLSearchParams();
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      return api<{ items: Folio[] }>(`/api/v1/folios?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:folios:${JSON.stringify(filters)}`,
  );

  const reservations = useAsyncData<{ items: Reservation[] }>(
    () => api<{ items: Reservation[] }>('/api/v1/reservations?limit=100', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:folios:reservations`,
  );

  function openCreate(): void {
    setReservationId('');
    setNotes('');
    modal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (reservationId === '') {
      toast({ title: 'Elegí una reserva', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const folio = await api<Folio>('/api/v1/folios', {
        method: 'POST',
        tenant,
        body: {
          reservationId,
          ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
          idempotencyKey: `folio-ui-${crypto.randomUUID()}`,
        },
      });
      modal.onClose();
      toast({ title: `Folio ${folio.number} abierto`, status: 'success' });
      router.push(`/folios/${folio.id}`);
    } catch (cause) {
      toast({
        title: 'No se pudo abrir el folio',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportFolios(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      await downloadCsv(
        `/api/v1/exports/folios?${params.toString()}`,
        tenant,
        `folios-${todayISO(0, propertyTimezone)}.csv`,
      );
      toast({ title: 'Exportación descargada', status: 'success' });
    } catch (cause) {
      toast({
        title: 'No se pudo exportar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(false);
    }
  }

  const items = folios.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Finanzas"
        title="Folios y cuentas"
        description="Cargos y pagos por estancia o reserva. Los importes se guardan en decimal con moneda explícita y nunca se aceptan datos completos de tarjeta."
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportFolios()}
              isLoading={exporting}
            >
              Exportar CSV
            </Button>
            <Button colorScheme="brand" onClick={openCreate}>
              Abrir folio
            </Button>
          </HStack>
        }
      />

      <SectionCard mb={5}>
        <HStack spacing={3} wrap="wrap" align="flex-end">
          <Field label="Buscar">
            <Input
              size="sm"
              placeholder="Número, reserva o huésped"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </Field>
          <Field label="Estado">
            <Select
              size="sm"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">Todos</option>
              <option value="OPEN">Abiertos</option>
              <option value="SETTLED">Saldados</option>
              <option value="CANCELLED">Cancelados</option>
            </Select>
          </Field>
        </HStack>
      </SectionCard>

      <SectionCard>
        <QueryFeedback
          loading={folios.loading}
          error={folios.error}
          onRetry={folios.reload}
          isEmpty={items.length === 0}
          emptyText="No hay folios para los filtros seleccionados."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Reserva</Th>
                  <Th isNumeric>Cargos</Th>
                  <Th isNumeric>Pagos</Th>
                  <Th isNumeric>Saldo</Th>
                  <Th>Estado</Th>
                  <Th>Creado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {items.map((folio) => {
                  const reservation = reservations.data?.items.find(
                    (item) => item.id === folio.reservationId,
                  );
                  return (
                    <Tr key={folio.id}>
                      <Td fontWeight="semibold">{folio.number}</Td>
                      <Td>
                        <Text fontSize="sm">
                          {reservation?.code ?? folio.reservationId?.slice(0, 8) ?? '—'}
                        </Text>
                        {reservation !== undefined && (
                          <Text fontSize="xs" color="textSecondary">
                            {reservation.guest.fullName} ·{' '}
                            {RESERVATION_STATUS_LABELS[reservation.status]}
                          </Text>
                        )}
                      </Td>
                      <Td isNumeric>{formatMoney(folio.totals.charges, folio.currencyCode)}</Td>
                      <Td isNumeric>{formatMoney(folio.totals.payments, folio.currencyCode)}</Td>
                      <Td isNumeric fontWeight="semibold">
                        {formatMoney(folio.totals.balance, folio.currencyCode)}
                      </Td>
                      <Td>
                        <StatusBadge
                          color={FOLIO_STATUS_COLORS[folio.status]}
                          label={FOLIO_STATUS_LABELS[folio.status]}
                        />
                      </Td>
                      <Td>{formatDateTime(folio.createdAt)}</Td>
                      <Td isNumeric>
                        <RowActionLink
                          href={`/folios/${folio.id}`}
                          label={`Abrir folio ${folio.number}`}
                        >
                          Abrir
                        </RowActionLink>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleCreate}>
          <ModalHeader>Abrir folio</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Reserva" isRequired>
                <Select
                  value={reservationId}
                  onChange={(event) => setReservationId(event.target.value)}
                  placeholder="Seleccioná una reserva"
                >
                  {(reservations.data?.items ?? []).map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.code} · {reservation.guest.fullName} ·{' '}
                      {RESERVATION_STATUS_LABELS[reservation.status]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notas" helper="Opcional. No incluyas datos de tarjeta.">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={4000}
                  rows={3}
                />
              </Field>
              {reservations.error !== null && (
                <Text color="danger.600" fontSize="sm">
                  {errorMessage(reservations.error)}
                </Text>
              )}
              <Badge colorScheme="sky" alignSelf="flex-start">
                Un folio activo por reserva o estancia
              </Badge>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={modal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              Abrir folio
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function FoliosPage() {
  return (
    <PropertyGate>
      <FoliosContent />
    </PropertyGate>
  );
}
