'use client';

import {
  Button,
  HStack,
  Input,
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
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { GuestDocuments } from '@/components/guest-documents';
import { GuestNotesPanel } from '@/components/guest-notes-panel';
import { DownloadIcon } from '@/components/icons';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import {
  DOCUMENT_TYPE_LABELS,
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  formatDateTime,
  todayISO,
} from '@/lib/format';
import type { Guest, GuestDocumentType } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { hasErrors, validateGuest, type FieldErrors } from '@/lib/validation';

interface GuestForm {
  fullName: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
  notes: string;
}

const EMPTY_FORM: GuestForm = {
  fullName: '',
  email: '',
  phone: '',
  documentType: '',
  documentNumber: '',
  notes: '',
};

function GuestsContent() {
  const { tenant, property } = useSession();
  const propertyTimezone = property?.timezone;
  const toast = useToast();
  const modal = useDisclosure();
  const notesModal = useDisclosure();
  const [notesTarget, setNotesTarget] = useState<Guest | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState<GuestForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsyncData<{ items: Guest[] }>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:guests:${JSON.stringify(filters)}`,
  );

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    modal.onOpen();
  }

  function openEdit(guest: Guest): void {
    setEditing(guest);
    setForm({
      fullName: guest.fullName,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      documentType: guest.documentType ?? '',
      documentNumber: guest.documentNumber ?? '',
      notes: guest.notes ?? '',
    });
    setErrors({});
    modal.onOpen();
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateGuest(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const documentPayload =
        form.documentType === ''
          ? { documentType: null, documentNumber: null }
          : { documentType: form.documentType, documentNumber: form.documentNumber.trim() };

      const body = {
        fullName: form.fullName.trim(),
        email: form.email.trim() === '' ? undefined : form.email.trim(),
        phone: form.phone.trim() === '' ? undefined : form.phone.trim(),
        notes: form.notes.trim() === '' ? undefined : form.notes.trim(),
        ...documentPayload,
      };

      if (editing === null) {
        await api<Guest>('/api/v1/guests', {
          method: 'POST',
          tenant,
          body: {
            fullName: body.fullName,
            ...(body.email !== undefined ? { email: body.email } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(body.documentType !== null
              ? { documentType: body.documentType, documentNumber: body.documentNumber }
              : {}),
          },
        });
        toast({ title: 'Huésped creado', status: 'success' });
      } else {
        await api<Guest>(`/api/v1/guests/${editing.id}`, { method: 'PATCH', tenant, body });
        toast({ title: 'Huésped actualizado', status: 'success' });
      }
      modal.onClose();
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo guardar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(guest: Guest): Promise<void> {
    const next = guest.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api<Guest>(`/api/v1/guests/${guest.id}`, {
        method: 'PATCH',
        tenant,
        body: { status: next },
      });
      toast({
        title: next === 'ACTIVE' ? 'Huésped reactivado' : 'Huésped deshabilitado',
        status: 'success',
      });
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo cambiar el estado',
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  async function exportGuests(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      await downloadCsv(
        `/api/v1/exports/guests?${params.toString()}`,
        tenant,
        `huespedes-${todayISO(0, propertyTimezone)}.csv`,
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

  return (
    <>
      <PageHeader
        title="Huéspedes"
        description="Perfiles minimizados por propiedad: datos de contacto y documento opcionales. No se fusionan perfiles automáticamente."
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportGuests()}
              isLoading={exporting}
            >
              Exportar CSV
            </Button>
            <Button colorScheme="brand" size="sm" onClick={openCreate}>
              Nuevo huésped
            </Button>
          </HStack>
        }
      />

      <SectionCard>
        <HStack wrap="wrap" spacing={2} mb={4}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({ ...current, search: searchInput.trim() }));
            }}
          >
            <HStack>
              <Input
                size="sm"
                width="260px"
                placeholder="Nombre, email, teléfono o documento"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <Button size="sm" type="submit" variant="outline">
                Buscar
              </Button>
            </HStack>
          </form>
          <Select
            size="sm"
            width="170px"
            aria-label="Estado del huésped"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="DISABLED">Deshabilitados</option>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchInput('');
              setFilters({ search: '', status: '' });
            }}
          >
            Limpiar
          </Button>
          <Text fontSize="xs" color="gray.500" ml="auto">
            {data?.items.length ?? 0} huéspedes cargados
          </Text>
        </HStack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText="No hay huéspedes que coincidan con la búsqueda."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Huésped</Th>
                  <Th>Contacto</Th>
                  <Th>Documento</Th>
                  <Th>Estado</Th>
                  <Th>Alta</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.items.map((guest) => (
                  <Tr key={guest.id}>
                    <Td>
                      <Text fontWeight="medium">{guest.fullName}</Text>
                      {guest.notes !== null && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="260px">
                          {guest.notes}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text fontSize="sm">{guest.email ?? '—'}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {guest.phone ?? 'sin teléfono'}
                      </Text>
                    </Td>
                    <Td>
                      {guest.documentType !== null && guest.documentNumber !== null ? (
                        <>
                          <Text fontSize="sm">{DOCUMENT_TYPE_LABELS[guest.documentType]}</Text>
                          <Text as="code" fontSize="xs">
                            {guest.documentNumber}
                          </Text>
                        </>
                      ) : (
                        <Text fontSize="sm" color="gray.500">
                          Sin documento
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge
                        color={RECORD_STATUS_COLORS[guest.status] ?? 'gray'}
                        label={RECORD_STATUS_LABELS[guest.status] ?? guest.status}
                      />
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="gray.500">
                        {formatDateTime(guest.createdAt)}
                      </Text>
                    </Td>
                    <Td>
                      <HStack spacing={1} justify="flex-end">
                        <GuestDocuments guestId={guest.id} guestName={guest.fullName} />
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setNotesTarget(guest);
                            notesModal.onOpen();
                          }}
                        >
                          Notas
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => openEdit(guest)}>
                          Editar
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => void toggleStatus(guest)}>
                          {guest.status === 'ACTIVE' ? 'Deshabilitar' : 'Reactivar'}
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={notesModal.isOpen} onClose={notesModal.onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Notas de {notesTarget?.fullName ?? 'huésped'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {notesTarget !== null && <GuestNotesPanel guestId={notesTarget.id} canManage />}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleSubmit(event)}>
          <ModalHeader>{editing === null ? 'Nuevo huésped' : 'Editar huésped'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Nombre completo" isRequired error={errors.fullName}>
                <Input
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Email" error={errors.email}>
                  <Input
                    type="email"
                    value={form.email}
                    maxLength={254}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="Teléfono" error={errors.phone}>
                  <Input
                    value={form.phone}
                    maxLength={32}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
              </HStack>
              <HStack spacing={4} align="flex-start">
                <Field label="Tipo de documento">
                  <Select
                    value={form.documentType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        documentType: event.target.value as GuestForm['documentType'],
                      })
                    }
                  >
                    <option value="">Sin documento</option>
                    <option value="PASSPORT">Pasaporte</option>
                    <option value="NATIONAL_ID">Documento nacional</option>
                    <option value="DRIVER_LICENSE">Licencia de conducir</option>
                    <option value="OTHER">Otro</option>
                  </Select>
                </Field>
                <Field label="Número de documento" error={errors.documentNumber}>
                  <Input
                    value={form.documentNumber}
                    onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
                    isDisabled={form.documentType === ''}
                    required={form.documentType !== ''}
                    minLength={3}
                    maxLength={64}
                  />
                </Field>
              </HStack>
              <Field
                label="Notas"
                error={errors.notes}
                helper="Máximo 2000 caracteres. Evitá datos sensibles innecesarios."
              >
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  maxLength={2000}
                  rows={3}
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={modal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function GuestsPage() {
  return (
    <PropertyGate>
      <GuestsContent />
    </PropertyGate>
  );
}
