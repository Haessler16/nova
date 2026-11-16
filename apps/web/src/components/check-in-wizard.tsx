'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useReducer, useState } from 'react';
import { QueryFeedback, StatusBadge } from '@/components/ui';
import { api, errorMessage, type TenantSelection } from '@/lib/api';
import {
  CHECK_IN_BLOCK_REASON_LABELS,
  HOUSEKEEPING_COLORS,
  HOUSEKEEPING_LABELS,
  INSTRUCTION_ACTION_LABELS,
  INSTRUCTION_CATEGORY_LABELS,
  INSTRUCTION_MOMENT_LABELS,
  INSTRUCTION_PRIORITY_COLORS,
  INSTRUCTION_PRIORITY_LABELS,
  INSTRUCTION_STATUS_LABELS,
  OPERATIONAL_COLORS,
  OPERATIONAL_LABELS,
  formatCalendarDate,
  formatDateTime,
} from '@/lib/format';
import type {
  CheckInReadiness,
  Reservation,
  ReservationInstruction,
  ReservationParty,
  ReservationPartyMember,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

const STEPS = ['Reserva', 'Habitación', 'Huéspedes', 'Confirmar'] as const;

/**
 * The check-in summary is intentionally narrower than the reservation panel:
 * only instructions actionable at arrival/check-in or high-risk alerts are
 * shown. Billing, check-out tasks and general notes stay in the reservation.
 */
function isCheckInRelevant(instruction: ReservationInstruction): boolean {
  if (instruction.status === 'COMPLETED' || instruction.status === 'DISMISSED') {
    return false;
  }
  if (instruction.executionMoment === 'PRE_ARRIVAL' || instruction.executionMoment === 'CHECK_IN') {
    return true;
  }
  if (
    instruction.actionType === 'PAYMENT_PREAUTHORIZATION' ||
    instruction.actionType === 'ARRIVAL_REMINDER'
  ) {
    return true;
  }
  return instruction.priority === 'CRITICAL';
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.500">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {value}
      </Text>
    </Box>
  );
}

function documentLabel(member: ReservationPartyMember): string {
  if (member.documentType === null || member.documentNumber === null) {
    return 'Sin documento registrado';
  }
  return `${member.documentType} ${member.documentNumber}`;
}

export function CheckInWizard({
  isOpen,
  reservation,
  tenant,
  onClose,
  onCompleted,
}: {
  isOpen: boolean;
  reservation: Reservation | null;
  tenant: TenantSelection;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [assignedRoomId, setAssignedRoomId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [instructionBusyId, setInstructionBusyId] = useState<string | null>(null);
  const [version, bumpVersion] = useReducer((value: number) => value + 1, 0);

  const reservationId = reservation?.id ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setStep(0);
    setRoomId(reservation?.roomId ?? '');
    setAssignedRoomId(reservation?.roomId ?? null);
    bumpVersion();
  }, [isOpen, reservation?.id, reservation?.roomId]);

  const readiness = useAsyncData<CheckInReadiness | null>(
    () =>
      reservationId === null
        ? Promise.resolve(null)
        : api<CheckInReadiness>(
            `/api/v1/front-office/reservations/${reservationId}/check-in-readiness`,
            { tenant },
          ),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-readiness:${reservationId ?? 'none'}:${version}`,
  );

  const party = useAsyncData<ReservationParty | null>(
    () =>
      reservationId === null
        ? Promise.resolve(null)
        : api<ReservationParty>(`/api/v1/reservations/${reservationId}/party`, { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-party:${reservationId ?? 'none'}:${version}`,
  );

  const instructions = useAsyncData<{ items: ReservationInstruction[] }>(
    () =>
      reservationId === null
        ? Promise.resolve({ items: [] })
        : api<{ items: ReservationInstruction[] }>(
            `/api/v1/reservations/${reservationId}/instructions?limit=100`,
            { tenant },
          ),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-instructions:${reservationId ?? 'none'}`,
  );

  const relevantInstructions = (instructions.data?.items ?? []).filter(isCheckInRelevant);
  const rooms = readiness.data?.rooms ?? [];
  const selectedRoom = rooms.find((room) => room.id === roomId) ?? null;
  const partyMembers =
    party.data === null
      ? []
      : [party.data.primary, ...party.data.companions].filter(
          (member): member is ReservationPartyMember => member !== null,
        );
  const partyBlocked = party.data?.readiness.checkIn === 'BLOCKED';
  const unreadInstructions = relevantInstructions.filter(
    (instruction) => instruction.status === 'NEW',
  ).length;

  async function acknowledgeInstruction(instruction: ReservationInstruction): Promise<void> {
    if (reservationId === null) {
      return;
    }
    setInstructionBusyId(instruction.id);
    try {
      await api(
        `/api/v1/reservations/${reservationId}/instructions/${instruction.id}/acknowledge`,
        { method: 'POST', tenant, body: {} },
      );
      instructions.reload();
      toast({ title: 'Lectura registrada', status: 'success' });
    } catch (cause) {
      toast({
        title: 'No se pudo registrar la lectura',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setInstructionBusyId(null);
    }
  }

  async function handleContinue(): Promise<void> {
    if (reservation === null) {
      return;
    }
    if (step === 1) {
      if (selectedRoom === null || !selectedRoom.eligible) {
        toast({ title: 'Seleccioná una habitación elegible', status: 'warning' });
        return;
      }
      if (assignedRoomId !== selectedRoom.id) {
        setBusy('assign-room');
        try {
          await api(`/api/v1/reservations/${reservation.id}/room-assignment`, {
            method: 'POST',
            tenant,
            body: { roomId: selectedRoom.id },
          });
          setAssignedRoomId(selectedRoom.id);
          toast({
            title: `Habitación ${selectedRoom.number} asignada`,
            status: 'success',
          });
          bumpVersion();
        } catch (cause) {
          toast({
            title: 'No se pudo asignar la habitación',
            description: errorMessage(cause),
            status: 'error',
            duration: 8000,
          });
          readiness.reload();
          return;
        } finally {
          setBusy(null);
        }
      }
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function handleConfirm(): Promise<void> {
    if (reservation === null) {
      return;
    }
    setBusy('check-in');
    try {
      await api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        tenant,
      });
      toast({
        title: `Check-in registrado para ${reservation.guest.fullName}`,
        status: 'success',
      });
      onCompleted();
      onClose();
    } catch (cause) {
      // The backend revalidated the room and the party inside its transaction.
      // Keep the wizard open and refresh so the operator sees the new state.
      toast({
        title: 'No se pudo confirmar el check-in',
        description: errorMessage(cause),
        status: 'error',
        duration: 10000,
      });
      bumpVersion();
      instructions.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={false}
      closeOnEsc={busy === null}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Check-in — {reservation?.guest.fullName ?? 'huésped'}</ModalHeader>
        <ModalCloseButton isDisabled={busy !== null} />
        <ModalBody maxH="70vh" overflowY="auto">
          <Stack spacing={4}>
            <HStack spacing={2} wrap="wrap">
              {STEPS.map((label, index) => (
                <Badge
                  key={label}
                  colorScheme={index === step ? 'brand' : index < step ? 'mint' : 'gray'}
                  textTransform="none"
                  px={2}
                  py={1}
                >
                  {index + 1}. {label}
                </Badge>
              ))}
            </HStack>
            <Divider />

            {step === 0 && reservation !== null && (
              <Stack spacing={3}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <SummaryRow label="Huésped" value={reservation.guest.fullName} />
                  <SummaryRow label="Reserva" value={reservation.code} />
                  <SummaryRow label="Llegada" value={formatCalendarDate(reservation.checkInDate)} />
                  <SummaryRow label="Salida" value={formatCalendarDate(reservation.checkOutDate)} />
                  <SummaryRow
                    label="Ocupación"
                    value={`${reservation.adults} adultos${
                      reservation.children > 0 ? ` · ${reservation.children} menores` : ''
                    }`}
                  />
                  <SummaryRow
                    label="Tipo de habitación"
                    value={`${reservation.roomType.name} (${reservation.nights} ${
                      reservation.nights === 1 ? 'noche' : 'noches'
                    })`}
                  />
                </SimpleGrid>
                {reservation.notes !== null && reservation.notes.trim() !== '' && (
                  <Box borderLeftWidth="3px" borderColor="sky.300" pl={3}>
                    <Text fontSize="xs" color="gray.500">
                      Observaciones de la reserva
                    </Text>
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {reservation.notes}
                    </Text>
                  </Box>
                )}
                <Divider />
                <Text fontWeight="semibold" fontSize="sm">
                  Instrucciones de llegada
                </Text>
                <Text fontSize="xs" color="gray.500">
                  El check-in no inicia preautorizaciones, no cobra pagos y no modifica tarifas.
                  Confirmá la lectura de lo que el huésped necesita al llegar.
                </Text>
                <QueryFeedback
                  loading={instructions.loading}
                  error={instructions.error}
                  onRetry={instructions.reload}
                  isEmpty={relevantInstructions.length === 0}
                  emptyText="Sin instrucciones relevantes para esta llegada."
                >
                  <Stack spacing={2}>
                    {relevantInstructions.map((instruction) => (
                      <Box
                        key={instruction.id}
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="md"
                        p={3}
                      >
                        <HStack spacing={2} wrap="wrap">
                          <StatusBadge
                            color={INSTRUCTION_PRIORITY_COLORS[instruction.priority]}
                            label={INSTRUCTION_PRIORITY_LABELS[instruction.priority]}
                          />
                          <Badge colorScheme="gray">
                            {INSTRUCTION_CATEGORY_LABELS[instruction.category]}
                          </Badge>
                          {instruction.executionMoment !== null && (
                            <Badge colorScheme="brand" textTransform="none">
                              {INSTRUCTION_MOMENT_LABELS[instruction.executionMoment]}
                            </Badge>
                          )}
                          {instruction.status !== 'NEW' && (
                            <Badge colorScheme="gray" textTransform="none">
                              {instruction.status === 'ACKNOWLEDGED'
                                ? 'Leída'
                                : INSTRUCTION_STATUS_LABELS[instruction.status]}
                            </Badge>
                          )}
                        </HStack>
                        <Text fontWeight="semibold" mt={1}>
                          {instruction.title}
                        </Text>
                        <Text fontSize="sm" mt={1}>
                          {instruction.body}
                        </Text>
                        {instruction.actionType === 'PAYMENT_PREAUTHORIZATION' && (
                          <Text fontSize="xs" color="warning.600" mt={1}>
                            {INSTRUCTION_ACTION_LABELS[instruction.actionType]}: pendiente de
                            ejecución en el módulo de pagos. No es un pago realizado ni una
                            autorización aprobada.
                          </Text>
                        )}
                        {instruction.status === 'NEW' && (
                          <Button
                            mt={2}
                            size="xs"
                            variant="outline"
                            colorScheme="brand"
                            isLoading={instructionBusyId === instruction.id}
                            onClick={() => void acknowledgeInstruction(instruction)}
                          >
                            Confirmar lectura
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </QueryFeedback>
              </Stack>
            )}

            {step === 1 && (
              <Stack spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  Solo se puede hacer check-in en una habitación activa, disponible, sin bloqueo
                  vigente, libre y con housekeeping listo. Una habitación limpia sin inspección
                  registrada se admite según la política del hotel.
                </Text>
                <QueryFeedback
                  loading={readiness.loading}
                  error={readiness.error}
                  onRetry={readiness.reload}
                  isEmpty={readiness.data === null}
                  emptyText="No se pudo cargar la elegibilidad de habitaciones."
                >
                  {readiness.data !== null && (
                    <Stack spacing={3}>
                      {readiness.data.currentRoomEligible === false && (
                        <Text fontSize="xs" color="warning.700">
                          La habitación asignada actualmente no cumple las reglas. Elegí otra para
                          continuar.
                        </Text>
                      )}
                      {rooms.length === 0 && (
                        <Text fontSize="sm" color="warning.600">
                          El tipo de habitación de la reserva no tiene unidades activas.
                        </Text>
                      )}
                      <Stack spacing={2}>
                        {rooms.map((room) => {
                          const selected = roomId === room.id;
                          return (
                            <Box
                              key={room.id}
                              borderWidth="1px"
                              borderColor={selected ? 'brand.400' : 'gray.200'}
                              bg={selected ? 'brand.50' : undefined}
                              borderRadius="md"
                              px={3}
                              py={2}
                            >
                              <HStack justify="space-between" align="flex-start" wrap="wrap">
                                <Box>
                                  <HStack spacing={2} wrap="wrap">
                                    <Text fontSize="sm" fontWeight="semibold">
                                      Hab. {room.number}
                                    </Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {room.roomType.name}
                                      {room.floor !== null ? ` · piso ${room.floor}` : ''}
                                    </Text>
                                    <StatusBadge
                                      color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                                      label={HOUSEKEEPING_LABELS[room.housekeepingState]}
                                    />
                                    {room.operationalState !== 'AVAILABLE' && (
                                      <StatusBadge
                                        color={OPERATIONAL_COLORS[room.operationalState]}
                                        label={OPERATIONAL_LABELS[room.operationalState]}
                                      />
                                    )}
                                    {room.occupancy === 'OCCUPIED' && (
                                      <Badge colorScheme="warning" textTransform="none">
                                        Ocupada
                                      </Badge>
                                    )}
                                  </HStack>
                                  {room.reasons.length > 0 && (
                                    <Text fontSize="xs" color="danger.600" mt={1}>
                                      {room.reasons
                                        .map((reason) => CHECK_IN_BLOCK_REASON_LABELS[reason])
                                        .join(' · ')}
                                    </Text>
                                  )}
                                  {room.activeBlock !== null && (
                                    <Text fontSize="xs" color="gray.500" mt={0.5}>
                                      Bloqueo hasta {formatDateTime(room.activeBlock.endsAt)}
                                    </Text>
                                  )}
                                </Box>
                                <Button
                                  size="xs"
                                  variant={selected ? 'solid' : 'outline'}
                                  colorScheme={selected ? 'brand' : 'gray'}
                                  isDisabled={!room.eligible}
                                  onClick={() => setRoomId(room.id)}
                                >
                                  {selected ? 'Seleccionada' : 'Elegir'}
                                </Button>
                              </HStack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Stack>
                  )}
                </QueryFeedback>
              </Stack>
            )}

            {step === 2 && (
              <Stack spacing={3}>
                <HStack justify="space-between" wrap="wrap">
                  <Text fontSize="sm" color="gray.600">
                    Verificá contacto y documento del huésped principal y de los acompañantes
                    requeridos.
                  </Text>
                  {party.data !== null && (
                    <Badge colorScheme={partyBlocked ? 'danger' : 'mint'} textTransform="none">
                      {partyBlocked
                        ? 'Check-in bloqueado por la fiesta'
                        : 'Fiesta sin bloqueo legal'}
                    </Badge>
                  )}
                </HStack>
                <QueryFeedback
                  loading={party.loading}
                  error={party.error}
                  onRetry={party.reload}
                  isEmpty={party.data === null || partyMembers.length === 0}
                  emptyText="No hay fiesta registrada. El backend validará la reserva al confirmar."
                >
                  <Stack spacing={2}>
                    {partyMembers.map((member) => (
                      <Box
                        key={`${member.guestId}-${member.role}`}
                        borderWidth="1px"
                        borderRadius="md"
                        px={3}
                        py={2}
                      >
                        <HStack justify="space-between" wrap="wrap">
                          <Text fontSize="sm" fontWeight="semibold">
                            {member.fullName}
                          </Text>
                          <Badge colorScheme={member.role === 'PRIMARY' ? 'brand' : 'gray'}>
                            {member.role === 'PRIMARY' ? 'Principal' : 'Acompañante'}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {documentLabel(member)}
                          {member.phone !== null ? ` · ${member.phone}` : ''}
                          {member.email !== null ? ` · ${member.email}` : ''}
                        </Text>
                        {member.ageGroup === 'MINOR' && (
                          <Text fontSize="xs" color="warning.700">
                            Menor · supervisión {member.minorSupervision ?? 'sin definir'}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </QueryFeedback>
                {partyBlocked && (
                  <Text fontSize="sm" color="danger.600">
                    Resolvé el bloqueo legal de la fiesta antes de confirmar. El backend rechazará
                    el check-in con `reservation_party_check_in_blocked`.
                  </Text>
                )}
                {reservation !== null && (
                  <Button
                    as={NextLink}
                    href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
                    size="xs"
                    variant="link"
                  >
                    Abrir perfil del huésped
                  </Button>
                )}
              </Stack>
            )}

            {step === 3 && reservation !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  Resumen final. Al confirmar, el backend revalida la habitación, la ocupación, los
                  bloqueos, el housekeeping y la fiesta dentro de una transacción. Solo verás éxito
                  después de la respuesta del servidor.
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <SummaryRow label="Huésped" value={reservation.guest.fullName} />
                  <SummaryRow label="Reserva" value={reservation.code} />
                  <SummaryRow
                    label="Estadía"
                    value={`${formatCalendarDate(reservation.checkInDate)} → ${formatCalendarDate(
                      reservation.checkOutDate,
                    )}`}
                  />
                  <SummaryRow
                    label="Habitación"
                    value={
                      selectedRoom === null
                        ? 'Sin habitación elegible'
                        : `Hab. ${selectedRoom.number}`
                    }
                  />
                  <SummaryRow
                    label="Housekeeping"
                    value={
                      selectedRoom === null
                        ? '—'
                        : HOUSEKEEPING_LABELS[selectedRoom.housekeepingState]
                    }
                  />
                  <SummaryRow
                    label="Documentación de la fiesta"
                    value={party.data?.readiness.checkIn ?? 'Sin datos'}
                  />
                  <SummaryRow label="Instrucciones sin leer" value={String(unreadInstructions)} />
                </SimpleGrid>
                {partyBlocked && (
                  <Text fontSize="sm" color="danger.600">
                    El check-in está bloqueado por la fiesta. Volvé al paso anterior para revisar.
                  </Text>
                )}
              </Stack>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={busy !== null}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            mr={3}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            isDisabled={step === 0 || busy !== null}
          >
            Volver
          </Button>
          {step < 3 ? (
            <Button
              colorScheme="brand"
              onClick={() => void handleContinue()}
              isLoading={busy === 'assign-room'}
              isDisabled={step === 1 && (selectedRoom === null || !selectedRoom.eligible)}
            >
              Continuar
            </Button>
          ) : (
            <Button
              colorScheme="brand"
              onClick={() => void handleConfirm()}
              isLoading={busy === 'check-in'}
              isDisabled={
                partyBlocked ||
                selectedRoom === null ||
                !selectedRoom.eligible ||
                assignedRoomId === null
              }
            >
              Confirmar check-in
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
