'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
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
import { useSession } from '@/context/session';
import { api, errorMessage, type TenantSelection } from '@/lib/api';
import {
  HOUSEKEEPING_COLORS,
  INSTRUCTION_PRIORITY_COLORS,
  OPERATIONAL_COLORS,
  checkInBlockReasonLabel,
  formatCalendarDate,
  formatDateTime,
  housekeepingLabel,
  instructionActionLabel,
  instructionCategoryLabel,
  instructionMomentLabel,
  instructionPriorityLabel,
  instructionStatusLabel,
  roomOperationalLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type {
  CheckInReadiness,
  CheckInRoomOption,
  CheckInWindow,
  Reservation,
  ReservationInstruction,
  ReservationParty,
  ReservationPartyMember,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

type Translator = ReturnType<typeof useI18n>['t'];

function nightsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.nightsOne' : 'common.nightsOther', { count });
}

function adultsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.adultsOne' : 'common.adultsOther', { count });
}

function minorsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.minorsOne' : 'common.minorsOther', { count });
}

function blockedWindowMessage(window: CheckInWindow, t: Translator): string {
  if (window.code === 'check_in_too_early') {
    return t('checkIn.blockedTooEarly', {
      date: formatCalendarDate(window.checkInDate),
      today: formatCalendarDate(window.localDate),
    });
  }
  return t('checkIn.blockedElapsed', {
    date: formatCalendarDate(window.checkOutDate),
    today: formatCalendarDate(window.localDate),
  });
}

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

function documentLabel(member: ReservationPartyMember, t: Translator): string {
  if (member.documentType === null || member.documentNumber === null) {
    return t('checkIn.party.documentMissing');
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
  const { actor } = useSession();
  const { t, locale } = useI18n();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [lease, setLease] = useState<{ roomId: string; leaseId: string } | null>(null);
  const [roomBusyId, setRoomBusyId] = useState<string | null>(null);
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
    setLease(null);
    setRoomBusyId(null);
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
  const selectedRoomId = roomId !== '' ? roomId : (readiness.data?.currentRoomId ?? '');
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const partyMembers =
    party.data === null
      ? []
      : [party.data.primary, ...party.data.companions].filter(
          (member): member is ReservationPartyMember => member !== null,
        );
  const partyBlocked = party.data?.readiness.checkIn === 'BLOCKED';
  const checkInWindow = readiness.data?.checkInWindow ?? null;
  const windowMessage =
    checkInWindow !== null && !checkInWindow.allowed
      ? blockedWindowMessage(checkInWindow, t)
      : null;
  const windowBlocked = windowMessage !== null;
  const unreadInstructions = relevantInstructions.filter(
    (instruction) => instruction.status === 'NEW',
  ).length;

  async function releaseHeldLease(): Promise<void> {
    if (lease === null) {
      return;
    }
    const current = lease;
    setLease(null);
    try {
      await api<void>(
        `/api/v1/inventory/rooms/${current.roomId}/assignment-leases/${current.leaseId}`,
        { method: 'DELETE', tenant },
      );
    } catch {
      // The key expires by TTL even if the release request cannot reach Redis.
    }
  }

  async function selectRoom(room: CheckInRoomOption): Promise<void> {
    if (room.lease !== null && room.lease.ownerUserId !== actor?.id) {
      toast({
        title: t('checkIn.toast.leaseHeldTitle'),
        description: t('checkIn.toast.leaseHeldHelp', { name: room.lease.ownerDisplayName }),
        status: 'warning',
      });
      readiness.reload();
      return;
    }
    if (lease?.roomId === room.id) {
      setRoomId(room.id);
      return;
    }

    await releaseHeldLease();
    if (room.lease !== null && room.lease.ownerUserId === actor?.id) {
      setLease({ roomId: room.id, leaseId: room.lease.leaseId });
      setRoomId(room.id);
      return;
    }

    setRoomBusyId(room.id);
    try {
      const acquired = await api<{ leaseId: string }>(
        `/api/v1/inventory/rooms/${room.id}/assignment-leases`,
        {
          method: 'POST',
          tenant,
          body: { reservationId: reservation?.id },
        },
      );
      setLease({ roomId: room.id, leaseId: acquired.leaseId });
      setRoomId(room.id);
    } catch (cause) {
      toast({
        title: t('checkIn.toast.selectError'),
        description: errorMessage(cause),
        status: 'warning',
        duration: 8000,
      });
      readiness.reload();
    } finally {
      setRoomBusyId(null);
    }
  }

  async function handleClose(): Promise<void> {
    await releaseHeldLease();
    onClose();
  }

  useEffect(() => {
    if (!isOpen || lease === null) {
      return;
    }
    const timer = window.setInterval(() => {
      void api(`/api/v1/inventory/rooms/${lease.roomId}/assignment-leases/${lease.leaseId}/renew`, {
        method: 'POST',
        tenant,
      }).catch(() => setLease(null));
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [isOpen, lease, tenant]);

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
      toast({ title: t('checkIn.toast.ackOk'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('checkIn.toast.ackError'),
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
    if (windowBlocked) {
      toast({
        title: t('checkIn.toast.windowBlocked'),
        description: windowMessage ?? undefined,
        status: 'warning',
      });
      return;
    }
    if (step === 1) {
      if (selectedRoom === null || !selectedRoom.eligible) {
        toast({ title: t('checkIn.toast.roomRequired'), status: 'warning' });
        return;
      }
      if (readiness.data?.currentRoomId !== selectedRoom.id) {
        setBusy('assign-room');
        try {
          await api(`/api/v1/reservations/${reservation.id}/room-assignment`, {
            method: 'POST',
            tenant,
            body: { roomId: selectedRoom.id },
          });
          toast({
            title: t('checkIn.toast.roomAssigned', { number: selectedRoom.number }),
            status: 'success',
          });
          bumpVersion();
          await releaseHeldLease();
        } catch (cause) {
          toast({
            title: t('checkIn.toast.assignError'),
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
    if (windowBlocked) {
      toast({
        title: t('checkIn.toast.windowBlocked'),
        description: windowMessage ?? undefined,
        status: 'warning',
      });
      return;
    }
    setBusy('check-in');
    try {
      await api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        tenant,
      });
      toast({
        title: t('checkIn.toast.confirmed', { name: reservation.guest.fullName }),
        status: 'success',
      });
      await releaseHeldLease();
      onCompleted();
      onClose();
    } catch (cause) {
      // The backend revalidated the room and the party inside its transaction.
      // Keep the wizard open and refresh so the operator sees the new state.
      toast({
        title: t('checkIn.toast.confirmError'),
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

  const stepLabels = [
    t('checkIn.step.reservation'),
    t('checkIn.step.room'),
    t('checkIn.step.party'),
    t('checkIn.step.confirm'),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void handleClose()}
      size="xl"
      closeOnOverlayClick={false}
      closeOnEsc={busy === null}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('checkIn.header', {
            name: reservation?.guest.fullName ?? t('checkIn.guestFallback'),
          })}
        </ModalHeader>
        <ModalCloseButton isDisabled={busy !== null} />
        <ModalBody maxH="70vh" overflowY="auto">
          <Stack spacing={4}>
            <HStack spacing={2} wrap="wrap">
              {stepLabels.map((label, index) => (
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

            {windowMessage !== null && (
              <Alert status="warning" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">{windowMessage}</AlertDescription>
              </Alert>
            )}

            {step === 0 && reservation !== null && (
              <Stack spacing={3}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <SummaryRow
                    label={t('checkIn.summary.guest')}
                    value={reservation.guest.fullName}
                  />
                  <SummaryRow label={t('checkIn.summary.reservation')} value={reservation.code} />
                  <SummaryRow
                    label={t('checkIn.summary.arrival')}
                    value={formatCalendarDate(reservation.checkInDate)}
                  />
                  <SummaryRow
                    label={t('checkIn.summary.departure')}
                    value={formatCalendarDate(reservation.checkOutDate)}
                  />
                  <SummaryRow
                    label={t('checkIn.summary.occupancy')}
                    value={`${adultsLabel(t, reservation.adults)}${
                      reservation.children > 0 ? ` · ${minorsLabel(t, reservation.children)}` : ''
                    }`}
                  />
                  <SummaryRow
                    label={t('checkIn.summary.roomType')}
                    value={t('checkIn.summary.roomTypeValue', {
                      type: reservation.roomType.name,
                      nights: nightsLabel(t, reservation.nights),
                    })}
                  />
                </SimpleGrid>
                {reservation.notes !== null && reservation.notes.trim() !== '' && (
                  <Box borderLeftWidth="3px" borderColor="sky.300" pl={3}>
                    <Text fontSize="xs" color="gray.500">
                      {t('checkIn.notes')}
                    </Text>
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {reservation.notes}
                    </Text>
                  </Box>
                )}
                <Divider />
                <Text fontWeight="semibold" fontSize="sm">
                  {t('checkIn.instructions.title')}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {t('checkIn.instructions.help')}
                </Text>
                <QueryFeedback
                  loading={instructions.loading}
                  error={instructions.error}
                  onRetry={instructions.reload}
                  isEmpty={relevantInstructions.length === 0}
                  emptyText={t('checkIn.instructions.empty')}
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
                            label={instructionPriorityLabel(locale, instruction.priority)}
                          />
                          <Badge colorScheme="gray">
                            {instructionCategoryLabel(locale, instruction.category)}
                          </Badge>
                          {instruction.executionMoment !== null && (
                            <Badge colorScheme="brand" textTransform="none">
                              {instructionMomentLabel(locale, instruction.executionMoment)}
                            </Badge>
                          )}
                          {instruction.status !== 'NEW' && (
                            <Badge colorScheme="gray" textTransform="none">
                              {instruction.status === 'ACKNOWLEDGED'
                                ? t('checkIn.instructions.read')
                                : instructionStatusLabel(locale, instruction.status)}
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
                            {t('checkIn.instructions.actionNote', {
                              action: instructionActionLabel(locale, instruction.actionType),
                            })}
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
                            {t('checkIn.instructions.ack')}
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
                  {t('checkIn.room.help')}
                </Text>
                <QueryFeedback
                  loading={readiness.loading}
                  error={readiness.error}
                  onRetry={readiness.reload}
                  isEmpty={readiness.data === null}
                  emptyText={t('checkIn.room.loadError')}
                >
                  {readiness.data !== null && (
                    <Stack spacing={3}>
                      {readiness.data.currentRoomEligible === false && (
                        <Text fontSize="xs" color="warning.700">
                          {t('checkIn.room.currentInvalid')}
                        </Text>
                      )}
                      {rooms.length === 0 && (
                        <Text fontSize="sm" color="warning.600">
                          {t('checkIn.room.noActive')}
                        </Text>
                      )}
                      <Stack spacing={2}>
                        {rooms.map((room) => {
                          const selected = selectedRoomId === room.id;
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
                                      {t('frontOffice.rack.room', { number: room.number })}
                                    </Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {reservation?.roomType.name}
                                      {room.floor !== null
                                        ? t('checkIn.room.floor', { floor: room.floor })
                                        : ''}
                                    </Text>
                                    <StatusBadge
                                      color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                                      label={housekeepingLabel(locale, room.housekeepingState)}
                                    />
                                    {room.operationalState !== 'AVAILABLE' && (
                                      <StatusBadge
                                        color={OPERATIONAL_COLORS[room.operationalState]}
                                        label={roomOperationalLabel(locale, room.operationalState)}
                                      />
                                    )}
                                    {room.occupancy === 'OCCUPIED' && (
                                      <Badge colorScheme="warning" textTransform="none">
                                        {t('checkIn.room.occupied')}
                                      </Badge>
                                    )}
                                  </HStack>
                                  {room.reasons.length > 0 && (
                                    <Text fontSize="xs" color="danger.600" mt={1}>
                                      {room.reasons
                                        .map((reason) => checkInBlockReasonLabel(locale, reason))
                                        .join(' · ')}
                                    </Text>
                                  )}
                                  {room.activeBlock !== null && (
                                    <Text fontSize="xs" color="gray.500" mt={0.5}>
                                      {t('checkIn.room.block', {
                                        time: formatDateTime(room.activeBlock.endsAt),
                                      })}
                                    </Text>
                                  )}
                                  {room.lease !== null && (
                                    <Text
                                      fontSize="xs"
                                      color={
                                        room.lease.ownerUserId === actor?.id
                                          ? 'brand.600'
                                          : 'warning.600'
                                      }
                                      mt={0.5}
                                    >
                                      {room.lease.ownerUserId === actor?.id
                                        ? t('checkIn.room.leaseOwn')
                                        : t('checkIn.room.leaseOther', {
                                            name: room.lease.ownerDisplayName,
                                          })}
                                      {' · '}
                                      {t('checkIn.room.leaseExpires', {
                                        time: formatDateTime(room.lease.expiresAt),
                                      })}
                                    </Text>
                                  )}
                                </Box>
                                <Button
                                  size="xs"
                                  variant={selected ? 'solid' : 'outline'}
                                  colorScheme={selected ? 'brand' : 'gray'}
                                  isDisabled={
                                    !room.eligible ||
                                    roomBusyId !== null ||
                                    (room.lease !== null && room.lease.ownerUserId !== actor?.id)
                                  }
                                  isLoading={roomBusyId === room.id}
                                  onClick={() => void selectRoom(room)}
                                >
                                  {selected ? t('checkIn.room.selected') : t('checkIn.room.choose')}
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
                    {t('checkIn.party.help')}
                  </Text>
                  {party.data !== null && (
                    <Badge colorScheme={partyBlocked ? 'danger' : 'mint'} textTransform="none">
                      {partyBlocked ? t('checkIn.party.blockedBadge') : t('checkIn.party.okBadge')}
                    </Badge>
                  )}
                </HStack>
                <QueryFeedback
                  loading={party.loading}
                  error={party.error}
                  onRetry={party.reload}
                  isEmpty={party.data === null || partyMembers.length === 0}
                  emptyText={t('checkIn.party.empty')}
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
                            {member.role === 'PRIMARY'
                              ? t('checkIn.party.primary')
                              : t('checkIn.party.companion')}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {documentLabel(member, t)}
                          {member.phone !== null ? ` · ${member.phone}` : ''}
                          {member.email !== null ? ` · ${member.email}` : ''}
                        </Text>
                        {member.ageGroup === 'MINOR' && (
                          <Text fontSize="xs" color="warning.700">
                            {t('checkIn.party.minor', {
                              supervision:
                                member.minorSupervision ?? t('checkIn.party.noSupervision'),
                            })}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </QueryFeedback>
                {partyBlocked && (
                  <Text fontSize="sm" color="danger.600">
                    {t('checkIn.party.blockedNote')}
                  </Text>
                )}
                {reservation !== null && (
                  <Button
                    as={NextLink}
                    href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
                    size="xs"
                    variant="link"
                  >
                    {t('checkIn.party.openGuest')}
                  </Button>
                )}
              </Stack>
            )}

            {step === 3 && reservation !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  {t('checkIn.review.help')}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <SummaryRow
                    label={t('checkIn.summary.guest')}
                    value={reservation.guest.fullName}
                  />
                  <SummaryRow label={t('checkIn.summary.reservation')} value={reservation.code} />
                  <SummaryRow
                    label={t('checkIn.review.stay')}
                    value={`${formatCalendarDate(reservation.checkInDate)} → ${formatCalendarDate(
                      reservation.checkOutDate,
                    )}`}
                  />
                  <SummaryRow
                    label={t('checkIn.review.room')}
                    value={
                      selectedRoom === null
                        ? t('checkIn.review.noRoom')
                        : t('frontOffice.rack.room', { number: selectedRoom.number })
                    }
                  />
                  <SummaryRow
                    label={t('checkIn.review.housekeeping')}
                    value={
                      selectedRoom === null
                        ? '—'
                        : housekeepingLabel(locale, selectedRoom.housekeepingState)
                    }
                  />
                  <SummaryRow
                    label={t('checkIn.review.partyDocs')}
                    value={party.data?.readiness.checkIn ?? t('checkIn.review.partyDocsNone')}
                  />
                  <SummaryRow
                    label={t('checkIn.review.unread')}
                    value={String(unreadInstructions)}
                  />
                </SimpleGrid>
                {partyBlocked && (
                  <Text fontSize="sm" color="danger.600">
                    {t('checkIn.review.blocked')}
                  </Text>
                )}
              </Stack>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={() => void handleClose()}
            isDisabled={busy !== null}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            mr={3}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            isDisabled={step === 0 || busy !== null}
          >
            {t('checkIn.action.back')}
          </Button>
          {step < 3 ? (
            <Button
              colorScheme="brand"
              onClick={() => void handleContinue()}
              isLoading={busy === 'assign-room'}
              isDisabled={
                windowBlocked ||
                roomBusyId !== null ||
                (step === 1 && (selectedRoom === null || !selectedRoom.eligible))
              }
            >
              {t('checkIn.action.continue')}
            </Button>
          ) : (
            <Button
              colorScheme="brand"
              onClick={() => void handleConfirm()}
              isLoading={busy === 'check-in'}
              isDisabled={
                windowBlocked || partyBlocked || selectedRoom === null || !selectedRoom.eligible
              }
            >
              {t('checkIn.action.confirm')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
