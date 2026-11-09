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
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { RECORD_STATUS_COLORS, RECORD_STATUS_LABELS } from '@/lib/format';
import type { RoomType } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface RoomTypeForm {
  name: string;
  code: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  bedType: string;
  status: 'ACTIVE' | 'DISABLED';
}

const EMPTY_FORM: RoomTypeForm = {
  name: '',
  code: '',
  description: '',
  capacityAdults: '2',
  capacityChildren: '0',
  bedType: '',
  status: 'ACTIVE',
};

function RoomTypesContent() {
  const { tenant } = useSession();
  const toast = useToast();
  const modal = useDisclosure();
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomTypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useAsyncData<{ items: RoomType[] }>(
    () =>
      api<{ items: RoomType[] }>(
        `/api/v1/inventory/room-types${statusFilter !== '' ? `?status=${statusFilter}` : ''}`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:room-types:${statusFilter}`,
  );

  function openCreate(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    modal.onOpen();
  }

  function openEdit(roomType: RoomType): void {
    setEditingId(roomType.id);
    setForm({
      name: roomType.name,
      code: roomType.code,
      description: roomType.description ?? '',
      capacityAdults: String(roomType.capacityAdults),
      capacityChildren: String(roomType.capacityChildren),
      bedType: roomType.bedType ?? '',
      status: roomType.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    modal.onOpen();
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const base = {
        name: form.name.trim(),
        description: form.description.trim() === '' ? undefined : form.description.trim(),
        capacityAdults: Number(form.capacityAdults),
        capacityChildren: Number(form.capacityChildren),
        bedType: form.bedType.trim() === '' ? undefined : form.bedType.trim(),
      };

      if (editingId === null) {
        await api<RoomType>('/api/v1/inventory/room-types', {
          method: 'POST',
          tenant,
          body: { ...base, code: form.code.trim() },
        });
        toast({ title: 'Tipo de habitación creado', status: 'success' });
      } else {
        await api<RoomType>(`/api/v1/inventory/room-types/${editingId}`, {
          method: 'PATCH',
          tenant,
          body: { ...base, status: form.status },
        });
        toast({ title: 'Tipo de habitación actualizado', status: 'success' });
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

  return (
    <>
      <PageHeader
        title="Tipos de habitación"
        description="Tipologías de la propiedad con capacidad y estado. Se usan al crear habitaciones y reservas."
        actions={
          <Button colorScheme="brand" size="sm" onClick={openCreate}>
            Nuevo tipo
          </Button>
        }
      />

      <SectionCard>
        <HStack mb={4} justify="space-between" wrap="wrap" spacing={3}>
          <HStack>
            <Text fontSize="sm" color="gray.600">
              Filtrar por estado
            </Text>
            <Select
              size="sm"
              width="150px"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="DISABLED">Deshabilitados</option>
            </Select>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            {data?.items.length ?? 0} tipos cargados
          </Text>
        </HStack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText="Todavía no hay tipos de habitación en esta propiedad."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Código</Th>
                  <Th isNumeric>Adultos</Th>
                  <Th isNumeric>Menores</Th>
                  <Th>Cama</Th>
                  <Th isNumeric>Habitaciones</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.items.map((roomType) => (
                  <Tr key={roomType.id}>
                    <Td>
                      <Text fontWeight="medium">{roomType.name}</Text>
                      {roomType.description !== null && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="320px">
                          {roomType.description}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text as="code" fontSize="xs">
                        {roomType.code}
                      </Text>
                    </Td>
                    <Td isNumeric>{roomType.capacityAdults}</Td>
                    <Td isNumeric>{roomType.capacityChildren}</Td>
                    <Td>{roomType.bedType ?? '—'}</Td>
                    <Td isNumeric>{roomType.roomCount}</Td>
                    <Td>
                      <StatusBadge
                        color={RECORD_STATUS_COLORS[roomType.status] ?? 'gray'}
                        label={RECORD_STATUS_LABELS[roomType.status] ?? roomType.status}
                      />
                    </Td>
                    <Td>
                      <Button size="xs" variant="ghost" onClick={() => openEdit(roomType)}>
                        Editar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleSubmit(event)}>
          <ModalHeader>
            {editingId === null ? 'Nuevo tipo de habitación' : 'Editar tipo'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Nombre" isRequired>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field
                label="Código"
                isRequired
                helper="1–24 letras, números, guiones o guiones bajos"
              >
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  isDisabled={editingId !== null}
                  required
                />
              </Field>
              <Field label="Descripción">
                <Input
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Capacidad adultos" isRequired>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.capacityAdults}
                    onChange={(event) => setForm({ ...form, capacityAdults: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Capacidad menores" isRequired>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.capacityChildren}
                    onChange={(event) => setForm({ ...form, capacityChildren: event.target.value })}
                    required
                  />
                </Field>
              </HStack>
              <Field label="Tipo de cama">
                <Input
                  value={form.bedType}
                  onChange={(event) => setForm({ ...form, bedType: event.target.value })}
                />
              </Field>
              {editingId !== null && (
                <Field label="Estado">
                  <Select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as 'ACTIVE' | 'DISABLED' })
                    }
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="DISABLED">Deshabilitado</option>
                  </Select>
                </Field>
              )}
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

export default function RoomTypesPage() {
  return (
    <PropertyGate>
      <RoomTypesContent />
    </PropertyGate>
  );
}
