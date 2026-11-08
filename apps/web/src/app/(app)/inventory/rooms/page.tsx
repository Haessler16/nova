'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
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
  SimpleGrid,
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
import { useEffect, useReducer, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import {
  Field,
  KeyValue,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  BLOCK_STATUS_LABELS,
  BLOCK_TYPE_LABELS,
  HOUSEKEEPING_COLORS,
  HOUSEKEEPING_LABELS,
  HOUSEKEEPING_TRANSITIONS,
  OPERATIONAL_COLORS,
  OPERATIONAL_LABELS,
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  formatDateTime,
  splitAttributes,
} from '@/lib/format';
import type {
  HousekeepingState,
  Room,
  RoomBlock,
  RoomHistoryEntry,
  RoomOperationalState,
  RoomType,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface RoomsData {
  rooms: Room[];
  roomTypes: RoomType[];
}

interface RoomForm {
  number: string;
  roomTypeId: string;
  floor: string;
  building: string;
  attributes: string;
  status: 'ACTIVE' | 'DISABLED';
}

function localDateTimeInput(offsetHours = 0): string {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function RoomsContent() {
  const { tenant } = useSession();
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    roomTypeId: '',
    operationalState: '',
    housekeepingState: '',
  });

  const { data, loading, error, reload } = useAsyncData<RoomsData>(
    async () => {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.roomTypeId !== '') params.set('roomTypeId', filters.roomTypeId);
      if (filters.operationalState !== '') params.set('operationalState', filters.operationalState);
      if (filters.housekeepingState !== '')
        params.set('housekeepingState', filters.housekeepingState);
      params.set('limit', '100');

      const [rooms, roomTypes] = await Promise.all([
        api<{ items: Room[] }>(`/api/v1/inventory/rooms?${params.toString()}`, { tenant }),
        api<{ items: RoomType[] }>('/api/v1/inventory/room-types?status=ACTIVE', { tenant }),
      ]);
      return { rooms: rooms.items, roomTypes: roomTypes.items };
    },
    `${tenant.organizationId}:${tenant.propertyId}:rooms:${JSON.stringify(filters)}`,
  );

  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const drawer = useDisclosure();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);

  const [createForm, setCreateForm] = useState<RoomForm>({
    number: '',
    roomTypeId: '',
    floor: '',
    building: '',
    attributes: '',
    status: 'ACTIVE',
  });
  const [editForm, setEditForm] = useState<RoomForm>({
    number: '',
    roomTypeId: '',
    floor: '',
    building: '',
    attributes: '',
    status: 'ACTIVE',
  });
  const [blockForm, setBlockForm] = useState({
    type: 'OUT_OF_ORDER',
    reason: '',
    startsAt: localDateTimeInput(),
    endsAt: localDateTimeInput(24),
  });
  const [transitionReason, setTransitionReason] = useState('');

  const selectedRoom = data?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  const detail = useAsyncData<{ blocks: RoomBlock[]; history: RoomHistoryEntry[] }>(
    async () => {
      if (selectedRoomId === null) {
        return { blocks: [], history: [] };
      }
      const [blocks, history] = await Promise.all([
        api<{ items: RoomBlock[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, { tenant }),
        api<{ items: RoomHistoryEntry[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/history`, {
          tenant,
        }),
      ]);
      return { blocks: blocks.items, history: history.items };
    },
    `${selectedRoomId ?? 'none'}:${detailVersion}`,
  );

  useEffect(() => {
    if (data !== null && createForm.roomTypeId === '' && data.roomTypes[0] !== undefined) {
      setCreateForm((current) => ({ ...current, roomTypeId: data.roomTypes[0]!.id }));
    }
  }, [data, createForm.roomTypeId]);

  function openDetail(room: Room): void {
    setSelectedRoomId(room.id);
    setTransitionReason('');
    setBlockForm({
      type: 'OUT_OF_ORDER',
      reason: '',
      startsAt: localDateTimeInput(),
      endsAt: localDateTimeInput(24),
    });
    drawer.onOpen();
  }

  function openEdit(room: Room): void {
    setSelectedRoomId(room.id);
    setEditForm({
      number: room.number,
      roomTypeId: room.roomTypeId,
      floor: room.floor ?? '',
      building: room.building ?? '',
      attributes: room.attributes.join(', '),
      status: room.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    editModal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await api<Room>('/api/v1/inventory/rooms', {
        method: 'POST',
        tenant,
        body: {
          number: createForm.number.trim(),
          roomTypeId: createForm.roomTypeId,
          ...(createForm.floor.trim() !== '' ? { floor: createForm.floor.trim() } : {}),
          ...(createForm.building.trim() !== '' ? { building: createForm.building.trim() } : {}),
          attributes: splitAttributes(createForm.attributes),
        },
      });
      toast({ title: 'Habitación creada', status: 'success' });
      createModal.onClose();
      setCreateForm({
        number: '',
        roomTypeId: data?.roomTypes[0]?.id ?? '',
        floor: '',
        building: '',
        attributes: '',
        status: 'ACTIVE',
      });
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo crear la habitación',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    setSaving(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}`, {
        method: 'PATCH',
        tenant,
        body: {
          number: editForm.number.trim(),
          roomTypeId: editForm.roomTypeId,
          floor: editForm.floor.trim(),
          building: editForm.building.trim(),
          attributes: splitAttributes(editForm.attributes),
          status: editForm.status,
        },
      });
      toast({ title: 'Habitación actualizada', status: 'success' });
      editModal.onClose();
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function transitionHousekeeping(state: HousekeepingState): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    setTransitioning(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}/housekeeping-transitions`, {
        method: 'POST',
        tenant,
        body: {
          state,
          ...(transitionReason.trim() !== '' ? { reason: transitionReason.trim() } : {}),
        },
      });
      toast({ title: `Housekeeping: ${HOUSEKEEPING_LABELS[state]}`, status: 'success' });
      setTransitionReason('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'Transición rechazada',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setTransitioning(false);
    }
  }

  async function createBlock(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    setBlockSaving(true);
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, {
        method: 'POST',
        tenant,
        body: {
          type: blockForm.type,
          reason: blockForm.reason.trim(),
          startsAt: new Date(blockForm.startsAt).toISOString(),
          endsAt: new Date(blockForm.endsAt).toISOString(),
        },
      });
      toast({ title: 'Bloqueo creado', status: 'success' });
      setBlockForm({ ...blockForm, reason: '' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo crear el bloqueo',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setBlockSaving(false);
    }
  }

  async function releaseBlock(block: RoomBlock): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    const reason = window.prompt('Motivo de liberación (opcional)', 'Liberado desde la UI');
    if (reason === null) {
      return;
    }
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks/${block.id}/release`, {
        method: 'POST',
        tenant,
        body: reason.trim() === '' ? {} : { reason: reason.trim() },
      });
      toast({ title: 'Bloqueo liberado', status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({ title: 'No se pudo liberar', description: errorMessage(cause), status: 'error' });
    }
  }

  const nextHousekeeping =
    selectedRoom !== null ? HOUSEKEEPING_TRANSITIONS[selectedRoom.housekeepingState] : [];

  return (
    <>
      <PageHeader
        title="Habitaciones"
        description="Inventario físico, housekeeping, bloqueos e historial. Housekeeping y estado operativo son dimensiones separadas."
        actions={
          <Button colorScheme="purple" size="sm" onClick={createModal.onOpen}>
            Nueva habitación
          </Button>
        }
      />

      <SectionCard>
        <Stack spacing={3} mb={4}>
          <HStack wrap="wrap" spacing={2}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFilters((current) => ({ ...current, search: searchInput.trim() }));
              }}
            >
              <HStack>
                <Input
                  size="sm"
                  width="220px"
                  placeholder="Número, piso, edificio…"
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
              width="180px"
              aria-label="Tipo de habitación"
              value={filters.roomTypeId}
              onChange={(event) => setFilters({ ...filters, roomTypeId: event.target.value })}
            >
              <option value="">Todos los tipos</option>
              {data?.roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              width="170px"
              aria-label="Estado operativo"
              value={filters.operationalState}
              onChange={(event) => setFilters({ ...filters, operationalState: event.target.value })}
            >
              <option value="">Estado operativo</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="OUT_OF_ORDER">Fuera de orden</option>
              <option value="OUT_OF_SERVICE">Fuera de servicio</option>
            </Select>
            <Select
              size="sm"
              width="170px"
              aria-label="Housekeeping"
              value={filters.housekeepingState}
              onChange={(event) =>
                setFilters({ ...filters, housekeepingState: event.target.value })
              }
            >
              <option value="">Housekeeping</option>
              <option value="DIRTY">Sucia</option>
              <option value="CLEANING">En limpieza</option>
              <option value="CLEAN">Limpia</option>
              <option value="INSPECTED">Inspeccionada</option>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setFilters({
                  search: '',
                  roomTypeId: '',
                  operationalState: '',
                  housekeepingState: '',
                });
              }}
            >
              Limpiar
            </Button>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            {data?.rooms.length ?? 0} habitaciones cargadas (máximo 100 por consulta).
          </Text>
        </Stack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.rooms.length ?? 0) === 0}
          emptyText="No hay habitaciones que coincidan con los filtros."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Número</Th>
                  <Th>Tipo</Th>
                  <Th>Piso / edificio</Th>
                  <Th>Housekeeping</Th>
                  <Th>Operativo</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.rooms.map((room) => (
                  <Tr key={room.id}>
                    <Td>
                      <Text fontWeight="semibold">{room.number}</Text>
                      {room.attributes.length > 0 && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="220px">
                          {room.attributes.join(' · ')}
                        </Text>
                      )}
                    </Td>
                    <Td>{room.roomType.name}</Td>
                    <Td>
                      {[room.floor, room.building].filter((value) => value !== null).join(' / ') ||
                        '—'}
                    </Td>
                    <Td>
                      <StatusBadge
                        color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                        label={HOUSEKEEPING_LABELS[room.housekeepingState]}
                      />
                    </Td>
                    <Td>
                      <StatusBadge
                        color={OPERATIONAL_COLORS[room.operationalState]}
                        label={OPERATIONAL_LABELS[room.operationalState]}
                      />
                    </Td>
                    <Td>
                      <StatusBadge
                        color={RECORD_STATUS_COLORS[room.status] ?? 'gray'}
                        label={RECORD_STATUS_LABELS[room.status] ?? room.status}
                      />
                    </Td>
                    <Td>
                      <HStack spacing={1} justify="flex-end">
                        <Button size="xs" variant="ghost" onClick={() => openDetail(room)}>
                          Detalle
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => openEdit(room)}>
                          Editar
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

      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreate(event)}>
          <ModalHeader>Nueva habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Número" isRequired helper="Único por propiedad">
                <Input
                  value={createForm.number}
                  onChange={(event) => setCreateForm({ ...createForm, number: event.target.value })}
                  required
                />
              </Field>
              <Field label="Tipo" isRequired>
                <Select
                  value={createForm.roomTypeId}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, roomTypeId: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {data?.roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name} ({roomType.capacityAdults} adultos)
                    </option>
                  ))}
                </Select>
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Piso">
                  <Input
                    value={createForm.floor}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, floor: event.target.value })
                    }
                  />
                </Field>
                <Field label="Edificio">
                  <Input
                    value={createForm.building}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, building: event.target.value })
                    }
                  />
                </Field>
              </HStack>
              <Field label="Atributos" helper="Separados por coma: balcón, accesible, silenciosa…">
                <Input
                  value={createForm.attributes}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, attributes: event.target.value })
                  }
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleEdit(event)}>
          <ModalHeader>Editar habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Número" isRequired>
                <Input
                  value={editForm.number}
                  onChange={(event) => setEditForm({ ...editForm, number: event.target.value })}
                  required
                />
              </Field>
              <Field label="Tipo" isRequired>
                <Select
                  value={editForm.roomTypeId}
                  onChange={(event) => setEditForm({ ...editForm, roomTypeId: event.target.value })}
                  required
                >
                  {data?.roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Piso">
                  <Input
                    value={editForm.floor}
                    onChange={(event) => setEditForm({ ...editForm, floor: event.target.value })}
                  />
                </Field>
                <Field label="Edificio">
                  <Input
                    value={editForm.building}
                    onChange={(event) => setEditForm({ ...editForm, building: event.target.value })}
                  />
                </Field>
              </HStack>
              <Field label="Atributos" helper="Separados por coma">
                <Input
                  value={editForm.attributes}
                  onChange={(event) => setEditForm({ ...editForm, attributes: event.target.value })}
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      status: event.target.value as 'ACTIVE' | 'DISABLED',
                    })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="DISABLED">Deshabilitado</option>
                </Select>
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            Habitación {selectedRoom?.number}
            {selectedRoom !== null && (
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                {selectedRoom.roomType.name} ·{' '}
                {selectedRoom.attributes.join(' · ') || 'sin atributos'}
              </Text>
            )}
          </DrawerHeader>
          <DrawerBody pb={10}>
            {selectedRoom !== null && (
              <Stack spacing={6}>
                <SimpleGrid columns={2} spacing={3}>
                  <KeyValue
                    label="Housekeeping"
                    value={HOUSEKEEPING_LABELS[selectedRoom.housekeepingState]}
                  />
                  <KeyValue
                    label="Operativo"
                    value={OPERATIONAL_LABELS[selectedRoom.operationalState]}
                  />
                  <KeyValue label="Piso" value={selectedRoom.floor ?? '—'} />
                  <KeyValue label="Edificio" value={selectedRoom.building ?? '—'} />
                </SimpleGrid>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Transición de housekeeping
                  </Text>
                  <HStack mb={2}>
                    <Input
                      size="sm"
                      placeholder="Motivo (opcional)"
                      value={transitionReason}
                      onChange={(event) => setTransitionReason(event.target.value)}
                    />
                  </HStack>
                  <HStack wrap="wrap">
                    {nextHousekeeping.length === 0 && (
                      <Text fontSize="sm" color="gray.500">
                        Sin transiciones disponibles.
                      </Text>
                    )}
                    {nextHousekeeping.map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant="outline"
                        isLoading={transitioning}
                        onClick={() => void transitionHousekeeping(state)}
                      >
                        → {HOUSEKEEPING_LABELS[state]}
                      </Button>
                    ))}
                  </HStack>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Bloqueos
                  </Text>
                  <QueryFeedback
                    loading={detail.loading}
                    error={detail.error}
                    onRetry={detail.reload}
                    isEmpty={(detail.data?.blocks.length ?? 0) === 0}
                    emptyText="Sin bloqueos registrados."
                  >
                    <Stack spacing={2} mb={4}>
                      {detail.data?.blocks.map((block) => (
                        <HStack
                          key={block.id}
                          justify="space-between"
                          borderWidth="1px"
                          borderRadius="md"
                          px={3}
                          py={2}
                          align="flex-start"
                        >
                          <Box>
                            <HStack spacing={2}>
                              <Badge colorScheme={block.type === 'OUT_OF_ORDER' ? 'red' : 'orange'}>
                                {BLOCK_TYPE_LABELS[block.type]}
                              </Badge>
                              <Badge colorScheme={block.status === 'ACTIVE' ? 'green' : 'gray'}>
                                {BLOCK_STATUS_LABELS[block.status]}
                              </Badge>
                            </HStack>
                            <Text fontSize="sm" mt={1}>
                              {block.reason}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {formatDateTime(block.startsAt)} → {formatDateTime(block.endsAt)}
                            </Text>
                          </Box>
                          {block.status === 'ACTIVE' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => void releaseBlock(block)}
                            >
                              Liberar
                            </Button>
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  </QueryFeedback>

                  <Box
                    as="form"
                    onSubmit={(event) => void createBlock(event)}
                    borderTopWidth="1px"
                    pt={3}
                  >
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Nuevo bloqueo
                    </Text>
                    <Stack spacing={3}>
                      <Select
                        size="sm"
                        value={blockForm.type}
                        onChange={(event) =>
                          setBlockForm({ ...blockForm, type: event.target.value })
                        }
                      >
                        <option value="OUT_OF_ORDER">Fuera de orden</option>
                        <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                      </Select>
                      <Input
                        size="sm"
                        placeholder="Motivo (3–500)"
                        value={blockForm.reason}
                        onChange={(event) =>
                          setBlockForm({ ...blockForm, reason: event.target.value })
                        }
                        required
                        minLength={3}
                      />
                      <HStack>
                        <Box flex="1">
                          <Text fontSize="xs" color="gray.500" mb={1}>
                            Inicio
                          </Text>
                          <Input
                            size="sm"
                            type="datetime-local"
                            value={blockForm.startsAt}
                            onChange={(event) =>
                              setBlockForm({ ...blockForm, startsAt: event.target.value })
                            }
                            required
                          />
                        </Box>
                        <Box flex="1">
                          <Text fontSize="xs" color="gray.500" mb={1}>
                            Fin
                          </Text>
                          <Input
                            size="sm"
                            type="datetime-local"
                            value={blockForm.endsAt}
                            onChange={(event) =>
                              setBlockForm({ ...blockForm, endsAt: event.target.value })
                            }
                            required
                          />
                        </Box>
                      </HStack>
                      <Button type="submit" size="sm" colorScheme="purple" isLoading={blockSaving}>
                        Crear bloqueo
                      </Button>
                    </Stack>
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Historial
                  </Text>
                  <QueryFeedback
                    loading={detail.loading}
                    error={detail.error}
                    onRetry={detail.reload}
                    isEmpty={(detail.data?.history.length ?? 0) === 0}
                    emptyText="Sin historial."
                  >
                    <Stack spacing={2} maxH="320px" overflowY="auto">
                      {detail.data?.history.map((entry) => (
                        <Box key={entry.id} borderLeftWidth="3px" borderColor="purple.200" pl={3}>
                          <Text fontSize="xs" color="gray.500">
                            {formatDateTime(entry.occurredAt)} · {entry.category}
                          </Text>
                          <Text fontSize="sm">
                            {entry.fromState ?? '—'} → <strong>{entry.toState}</strong>
                          </Text>
                          {entry.reason !== null && (
                            <Text fontSize="xs" color="gray.600">
                              {entry.reason}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </QueryFeedback>
                </Box>
              </Stack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default function RoomsPage() {
  return (
    <PropertyGate>
      <RoomsContent />
    </PropertyGate>
  );
}
