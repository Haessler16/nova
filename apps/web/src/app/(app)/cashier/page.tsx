'use client';

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
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
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DateField } from '@/components/date-field';
import {
  Field,
  MetricCard,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage, isApiError } from '@/lib/api';
import {
  CASH_MOVEMENT_LABELS,
  CASH_SESSION_STATUS_COLORS,
  CASH_SESSION_STATUS_LABELS,
  OPERATIONAL_CLOSE_COLORS,
  OPERATIONAL_CLOSE_LABELS,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type {
  CashMovementType,
  CashSession,
  NightAuditBlocker,
  OperationalClose,
  OperationalDay,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  buildErrors,
  calendarDateField,
  hasErrors,
  moneyField,
  optionalText,
  reasonField,
  requiredText,
  type FieldErrors,
} from '@/lib/validation';

const MOVEMENT_TYPES: CashMovementType[] = ['CASH_IN', 'CASH_OUT', 'REFUND', 'ADJUSTMENT'];

interface CashSessionList {
  items: CashSession[];
}

interface OperationalCloseList {
  items: OperationalClose[];
}

function CashierContent() {
  const { tenant } = useSession();
  const toast = useToast();
  const reopenModal = useDisclosure();

  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [blockers, setBlockers] = useState<NightAuditBlocker[]>([]);
  const [reopenTarget, setReopenTarget] = useState<OperationalClose | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const [openForm, setOpenForm] = useState({
    name: '',
    operationalDate: '',
    openingAmount: '0.00',
  });
  const [movementForm, setMovementForm] = useState<{
    type: CashMovementType;
    amount: string;
    description: string;
  }>({ type: 'CASH_IN', amount: '', description: '' });
  const [closeForm, setCloseForm] = useState({
    closingAmount: '',
    varianceReason: '',
    notes: '',
  });
  const [auditForm, setAuditForm] = useState({
    operationalDate: '',
    force: false,
    forceReason: '',
    notes: '',
  });

  const operationalDay = useAsyncData<OperationalDay>(
    () => api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:operational-day`,
  );

  const sessions = useAsyncData<CashSessionList>(
    () => api<CashSessionList>('/api/v1/cash-sessions', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:sessions`,
  );

  const closes = useAsyncData<OperationalCloseList>(
    () => api<OperationalCloseList>('/api/v1/operational-days', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:closes`,
  );

  const openSession = sessions.data?.items.find((item) => item.status === 'OPEN') ?? null;
  const latestClose = closes.data?.items[0] ?? null;

  useEffect(() => {
    const date = operationalDay.data?.operationalDate;
    if (date === undefined) {
      return;
    }
    setOpenForm((current) => ({
      name: current.name === '' ? `Caja ${date}` : current.name,
      operationalDate: current.operationalDate === '' ? date : current.operationalDate,
      openingAmount: current.openingAmount,
    }));
    setAuditForm((current) => ({
      ...current,
      operationalDate: current.operationalDate === '' ? date : current.operationalDate,
    }));
  }, [operationalDay.data?.operationalDate]);

  useEffect(() => {
    if (openSession === null) {
      setCloseForm({ closingAmount: '', varianceReason: '', notes: '' });
      return;
    }
    setCloseForm({
      closingAmount: openSession.expectedCashAmount,
      varianceReason: '',
      notes: '',
    });
  }, [openSession]);

  async function submitOpen(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = buildErrors([
      ['open.name', requiredText(openForm.name, 'El nombre de la sesión', { max: 120 })],
      ['open.operationalDate', calendarDateField(openForm.operationalDate, 'El día operativo')],
      ['open.openingAmount', moneyField(openForm.openingAmount, 'El fondo inicial')],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBusy('open');
    try {
      await api('/api/v1/cash-sessions', {
        method: 'POST',
        tenant,
        body: {
          name: openForm.name,
          operationalDate: openForm.operationalDate,
          openingAmount: openForm.openingAmount,
          idempotencyKey: `cash-open-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Caja abierta', status: 'success' });
      sessions.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo abrir la caja',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitMovement(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (openSession === null) {
      return;
    }
    const nextErrors = buildErrors([
      ['movement.amount', moneyField(movementForm.amount, 'El importe', { allowZero: false })],
      ['movement.description', optionalText(movementForm.description, 'El detalle', { max: 4000 })],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBusy('movement');
    try {
      await api(`/api/v1/cash-sessions/${openSession.id}/movements`, {
        method: 'POST',
        tenant,
        body: {
          type: movementForm.type,
          amount: movementForm.amount,
          ...(movementForm.description.trim() !== ''
            ? { description: movementForm.description.trim() }
            : {}),
          idempotencyKey: `cash-movement-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Movimiento registrado', status: 'success' });
      setMovementForm((current) => ({ ...current, amount: '', description: '' }));
      sessions.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo registrar el movimiento',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitClose(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (openSession === null) {
      return;
    }
    const nextErrors = buildErrors([
      ['close.closingAmount', moneyField(closeForm.closingAmount, 'El efectivo contado')],
      [
        'close.varianceReason',
        optionalText(closeForm.varianceReason, 'El motivo de diferencia', { max: 500 }),
      ],
      ['close.notes', optionalText(closeForm.notes, 'Las notas', { max: 4000 })],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBusy('close');
    try {
      await api(`/api/v1/cash-sessions/${openSession.id}/close`, {
        method: 'POST',
        tenant,
        body: {
          closingAmount: closeForm.closingAmount,
          ...(closeForm.varianceReason.trim() !== ''
            ? { varianceReason: closeForm.varianceReason.trim() }
            : {}),
          ...(closeForm.notes.trim() !== '' ? { notes: closeForm.notes.trim() } : {}),
          idempotencyKey: `cash-close-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Caja cerrada', status: 'success' });
      sessions.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo cerrar la caja',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitAudit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = buildErrors([
      ['audit.operationalDate', calendarDateField(auditForm.operationalDate, 'El día operativo')],
      [
        'audit.forceReason',
        auditForm.force
          ? reasonField(auditForm.forceReason, 'El motivo del cierre forzado')
          : optionalText(auditForm.forceReason, 'El motivo', { max: 500 }),
      ],
      ['audit.notes', optionalText(auditForm.notes, 'Las notas', { max: 4000 })],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBusy('audit');
    setBlockers([]);
    try {
      await api('/api/v1/operational-days/close', {
        method: 'POST',
        tenant,
        body: {
          operationalDate: auditForm.operationalDate,
          force: auditForm.force,
          ...(auditForm.forceReason.trim() !== ''
            ? { forceReason: auditForm.forceReason.trim() }
            : {}),
          ...(auditForm.notes.trim() !== '' ? { notes: auditForm.notes.trim() } : {}),
          idempotencyKey: `night-audit-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Día operativo cerrado', status: 'success' });
      setAuditForm((current) => ({
        ...current,
        force: false,
        forceReason: '',
        notes: '',
      }));
      closes.reload();
      sessions.reload();
    } catch (cause) {
      if (isApiError(cause) && cause.code === 'night_audit_blocked') {
        const details = cause.details as { blockers?: NightAuditBlocker[] } | undefined;
        setBlockers(details?.blockers ?? []);
        toast({
          title: 'El día tiene bloqueos pendientes',
          description: 'Revisá la lista y, si corresponde, forzá el cierre con un motivo.',
          status: 'warning',
        });
      } else {
        toast({
          title: 'No se pudo cerrar el día operativo',
          description: errorMessage(cause),
          status: 'error',
        });
      }
    } finally {
      setBusy(null);
    }
  }

  function openReopen(close: OperationalClose): void {
    setReopenTarget(close);
    setReopenReason('');
    reopenModal.onOpen();
  }

  async function submitReopen(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (reopenTarget === null) {
      return;
    }
    const nextErrors = buildErrors([['reopen.reason', reasonField(reopenReason)]]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBusy('reopen');
    try {
      await api(`/api/v1/operational-days/${reopenTarget.id}/reopen`, {
        method: 'POST',
        tenant,
        body: {
          reason: reopenReason,
          idempotencyKey: `night-audit-reopen-ui-${crypto.randomUUID()}`,
        },
      });
      toast({ title: 'Día operativo reabierto', status: 'success' });
      reopenModal.onClose();
      closes.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo reabrir el día',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  const sessionItems = sessions.data?.items ?? [];
  const closeItems = closes.data?.items ?? [];
  const cup = openSession?.currencyCode ?? 'BRL';

  return (
    <>
      <PageHeader
        eyebrow="Caja y cierre"
        title="Caja y día operativo"
        description="Apertura, movimientos y arqueo de caja, más el cierre del día operativo. El backend valida arqueo, bloqueos y permisos; forzar un cierre requiere un motivo auditado."
      />

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={5}>
        <MetricCard
          label="Día operativo"
          value={operationalDay.data?.operationalDate ?? '—'}
          hint={
            operationalDay.data === null
              ? undefined
              : `${operationalDay.data.localTime} · ${operationalDay.data.timezone}`
          }
          accent="brand"
          loading={operationalDay.loading}
        />
        <MetricCard
          label="Caja"
          value={
            openSession === null ? (
              <StatusBadge color="warning" label="Cerrada" />
            ) : (
              <StatusBadge
                color={CASH_SESSION_STATUS_COLORS[openSession.status]}
                label={CASH_SESSION_STATUS_LABELS[openSession.status]}
              />
            )
          }
          hint={openSession?.name ?? 'Sin sesión abierta'}
          accent={openSession === null ? 'warning' : 'mint'}
          loading={sessions.loading}
        />
        <MetricCard
          label="Efectivo esperado"
          value={openSession === null ? '—' : formatMoney(openSession.expectedCashAmount, cup)}
          hint={
            openSession === null
              ? 'Abrí una caja para operar'
              : `Apertura ${formatMoney(openSession.openingAmount, cup)}`
          }
          accent="sky"
          loading={sessions.loading}
        />
        <MetricCard
          label="Último cierre"
          value={
            latestClose === null ? (
              'Sin cierre'
            ) : (
              <StatusBadge
                color={OPERATIONAL_CLOSE_COLORS[latestClose.status]}
                label={OPERATIONAL_CLOSE_LABELS[latestClose.status]}
              />
            )
          }
          hint={
            latestClose === null
              ? 'Todavía no se cerró un día'
              : formatCalendarDate(latestClose.operationalDate)
          }
          accent={latestClose?.status === 'CLOSED' ? 'mint' : 'warning'}
          loading={closes.loading}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start" mb={5}>
        <SectionCard>
          <HStack justify="space-between" mb={4}>
            <Box>
              <Text fontWeight="semibold">Caja</Text>
              <Text fontSize="xs" color="textSecondary">
                Una sola sesión abierta por propiedad.
              </Text>
            </Box>
            {openSession !== null && (
              <Badge colorScheme="mint">{formatMoney(openSession.expectedCashAmount, cup)}</Badge>
            )}
          </HStack>

          <QueryFeedback
            loading={sessions.loading}
            error={sessions.error}
            onRetry={sessions.reload}
          >
            {openSession === null ? (
              <Box as="form" onSubmit={submitOpen}>
                <Stack spacing={3}>
                  <Field label="Nombre de la sesión" isRequired error={errors['open.name']}>
                    <Input
                      size="sm"
                      value={openForm.name}
                      maxLength={120}
                      onChange={(event) =>
                        setOpenForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                  </Field>
                  <Field
                    label="Día operativo"
                    isRequired
                    error={errors['open.operationalDate']}
                    helper="No puede ser posterior al día operativo actual."
                  >
                    <DateField
                      value={openForm.operationalDate}
                      placeholder="dd/mm/aaaa"
                      ariaLabel="Día operativo de la sesión"
                      onChange={(operationalDate) =>
                        setOpenForm((current) => ({ ...current, operationalDate }))
                      }
                    />
                  </Field>
                  <Field
                    label={`Fondo inicial (${cup})`}
                    isRequired
                    error={errors['open.openingAmount']}
                    helper="Hasta dos decimales."
                  >
                    <Input
                      size="sm"
                      inputMode="decimal"
                      value={openForm.openingAmount}
                      onChange={(event) =>
                        setOpenForm((current) => ({
                          ...current,
                          openingAmount: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Button
                    type="submit"
                    colorScheme="brand"
                    alignSelf="flex-start"
                    isLoading={busy === 'open'}
                  >
                    Abrir caja
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={4}>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                      Apertura
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {formatMoney(openSession.openingAmount, cup)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                      Esperado
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {formatMoney(openSession.expectedCashAmount, cup)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                      Abierta
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {formatDateTime(openSession.openedAt)}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Divider />

                <Box>
                  <Text fontWeight="semibold" fontSize="sm" mb={2}>
                    Movimientos
                  </Text>
                  {openSession.movements.length === 0 ? (
                    <Text fontSize="sm" color="textSecondary">
                      Sin movimientos registrados.
                    </Text>
                  ) : (
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Tipo</Th>
                            <Th isNumeric>Importe</Th>
                            <Th>Detalle</Th>
                            <Th>Registrado</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {openSession.movements.map((movement) => (
                            <Tr key={movement.id}>
                              <Td>{CASH_MOVEMENT_LABELS[movement.type]}</Td>
                              <Td isNumeric>
                                {formatMoney(movement.amount, movement.currencyCode)}
                              </Td>
                              <Td>
                                <Text fontSize="sm" noOfLines={2}>
                                  {movement.description ?? '—'}
                                </Text>
                              </Td>
                              <Td>{formatDateTime(movement.createdAt)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>

                <Divider />

                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} alignItems="start">
                  <Box as="form" onSubmit={submitMovement}>
                    <Stack spacing={3}>
                      <Text fontWeight="semibold" fontSize="sm">
                        Registrar movimiento
                      </Text>
                      <Field label="Tipo" isRequired>
                        <Select
                          size="sm"
                          value={movementForm.type}
                          onChange={(event) =>
                            setMovementForm((current) => ({
                              ...current,
                              type: event.target.value as CashMovementType,
                            }))
                          }
                        >
                          {MOVEMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {CASH_MOVEMENT_LABELS[type]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label={`Importe (${cup})`}
                        isRequired
                        error={errors['movement.amount']}
                        helper="Hasta dos decimales."
                      >
                        <Input
                          size="sm"
                          inputMode="decimal"
                          value={movementForm.amount}
                          onChange={(event) =>
                            setMovementForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                          required
                        />
                      </Field>
                      <Field label="Detalle" error={errors['movement.description']}>
                        <Input
                          size="sm"
                          value={movementForm.description}
                          maxLength={4000}
                          onChange={(event) =>
                            setMovementForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Button
                        type="submit"
                        size="sm"
                        colorScheme="brand"
                        alignSelf="flex-start"
                        isLoading={busy === 'movement'}
                      >
                        Registrar
                      </Button>
                    </Stack>
                  </Box>

                  <Box as="form" onSubmit={submitClose}>
                    <Stack spacing={3}>
                      <Text fontWeight="semibold" fontSize="sm">
                        Cerrar y arquear
                      </Text>
                      <Field
                        label={`Efectivo contado (${cup})`}
                        isRequired
                        error={errors['close.closingAmount']}
                        helper={`Esperado: ${formatMoney(openSession.expectedCashAmount, cup)}`}
                      >
                        <Input
                          size="sm"
                          inputMode="decimal"
                          value={closeForm.closingAmount}
                          onChange={(event) =>
                            setCloseForm((current) => ({
                              ...current,
                              closingAmount: event.target.value,
                            }))
                          }
                          required
                        />
                      </Field>
                      <Field
                        label="Motivo de diferencia"
                        error={errors['close.varianceReason']}
                        helper="Obligatorio si el contado difiere del esperado."
                      >
                        <Input
                          size="sm"
                          value={closeForm.varianceReason}
                          maxLength={500}
                          onChange={(event) =>
                            setCloseForm((current) => ({
                              ...current,
                              varianceReason: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Notas">
                        <Textarea
                          size="sm"
                          rows={2}
                          maxLength={4000}
                          value={closeForm.notes}
                          onChange={(event) =>
                            setCloseForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Button
                        type="submit"
                        size="sm"
                        colorScheme="mint"
                        alignSelf="flex-start"
                        isLoading={busy === 'close'}
                      >
                        Cerrar caja
                      </Button>
                    </Stack>
                  </Box>
                </SimpleGrid>
              </Stack>
            )}
          </QueryFeedback>
        </SectionCard>

        <SectionCard>
          <Box mb={4}>
            <Text fontWeight="semibold">Cierre del día operativo</Text>
            <Text fontSize="xs" color="textSecondary">
              Night audit: exige caja cerrada, folios resueltos y llegadas o estancias pendientes
              resueltas. Podés forzar el cierre con un motivo auditado.
            </Text>
          </Box>

          {latestClose !== null && (
            <Box mb={4} p={3} borderWidth="1px" borderColor="line" borderRadius="lg" bg="gray.50">
              <HStack justify="space-between" align="flex-start" spacing={3}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">
                    {formatCalendarDate(latestClose.operationalDate)}
                  </Text>
                  <Text fontSize="xs" color="textSecondary">
                    {latestClose.snapshot.forced
                      ? 'Cierre forzado con motivo registrado.'
                      : 'Cierre sin bloqueos.'}{' '}
                    Saldo de folios abiertos:{' '}
                    {formatMoney(
                      latestClose.snapshot.totals.openFolioBalance,
                      latestClose.snapshot.currencyCode,
                    )}
                  </Text>
                </Box>
                <StatusBadge
                  color={OPERATIONAL_CLOSE_COLORS[latestClose.status]}
                  label={OPERATIONAL_CLOSE_LABELS[latestClose.status]}
                />
              </HStack>
              {latestClose.status === 'CLOSED' && (
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="warning"
                  mt={3}
                  onClick={() => openReopen(latestClose)}
                >
                  Reabrir día
                </Button>
              )}
            </Box>
          )}

          {blockers.length > 0 && (
            <Box
              mb={4}
              p={3}
              borderWidth="1px"
              borderColor="warning.200"
              borderRadius="lg"
              bg="warning.50"
            >
              <Text fontSize="sm" fontWeight="semibold" color="warning.700" mb={2}>
                Bloqueos detectados
              </Text>
              <Stack spacing={1}>
                {blockers.map((blocker) => (
                  <Text key={blocker.code} fontSize="xs" color="warning.700">
                    {blocker.message} ({blocker.count})
                  </Text>
                ))}
              </Stack>
            </Box>
          )}

          <Box as="form" onSubmit={submitAudit}>
            <Stack spacing={3}>
              <Field label="Día operativo" isRequired error={errors['audit.operationalDate']}>
                <DateField
                  value={auditForm.operationalDate}
                  placeholder="dd/mm/aaaa"
                  ariaLabel="Día operativo del cierre"
                  onChange={(operationalDate) =>
                    setAuditForm((current) => ({ ...current, operationalDate }))
                  }
                />
              </Field>
              <Checkbox
                size="sm"
                isChecked={auditForm.force}
                onChange={(event) =>
                  setAuditForm((current) => ({ ...current, force: event.target.checked }))
                }
              >
                Forzar cierre aunque existan bloqueos
              </Checkbox>
              {auditForm.force && (
                <Field
                  label="Motivo del cierre forzado"
                  isRequired
                  error={errors['audit.forceReason']}
                >
                  <Textarea
                    size="sm"
                    rows={2}
                    maxLength={500}
                    value={auditForm.forceReason}
                    onChange={(event) =>
                      setAuditForm((current) => ({
                        ...current,
                        forceReason: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>
              )}
              <Field label="Notas">
                <Textarea
                  size="sm"
                  rows={2}
                  maxLength={4000}
                  value={auditForm.notes}
                  onChange={(event) =>
                    setAuditForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </Field>
              <Button
                type="submit"
                colorScheme="brand"
                alignSelf="flex-start"
                isLoading={busy === 'audit'}
              >
                Cerrar día operativo
              </Button>
            </Stack>
          </Box>
        </SectionCard>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start">
        <SectionCard>
          <Text fontWeight="semibold" mb={3}>
            Sesiones de caja
          </Text>
          <QueryFeedback
            loading={sessions.loading}
            error={sessions.error}
            onRetry={sessions.reload}
            isEmpty={sessionItems.length === 0}
            emptyText="Todavía no hay sesiones de caja."
          >
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Día</Th>
                    <Th>Nombre</Th>
                    <Th isNumeric>Apertura</Th>
                    <Th isNumeric>Cierre</Th>
                    <Th isNumeric>Diferencia</Th>
                    <Th>Estado</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sessionItems.map((session) => (
                    <Tr key={session.id}>
                      <Td>{formatCalendarDate(session.operationalDate)}</Td>
                      <Td>
                        <Text fontSize="sm" noOfLines={1}>
                          {session.name}
                        </Text>
                      </Td>
                      <Td isNumeric>{formatMoney(session.openingAmount, session.currencyCode)}</Td>
                      <Td isNumeric>
                        {session.closingAmount === null
                          ? '—'
                          : formatMoney(session.closingAmount, session.currencyCode)}
                      </Td>
                      <Td isNumeric>
                        {session.status === 'CLOSED'
                          ? formatMoney(session.variance, session.currencyCode)
                          : '—'}
                      </Td>
                      <Td>
                        <StatusBadge
                          color={CASH_SESSION_STATUS_COLORS[session.status]}
                          label={CASH_SESSION_STATUS_LABELS[session.status]}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </QueryFeedback>
        </SectionCard>

        <SectionCard>
          <Text fontWeight="semibold" mb={3}>
            Cierres operativos
          </Text>
          <QueryFeedback
            loading={closes.loading}
            error={closes.error}
            onRetry={closes.reload}
            isEmpty={closeItems.length === 0}
            emptyText="Todavía no hay cierres operativos."
          >
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Día</Th>
                    <Th>Estado</Th>
                    <Th>Forzado</Th>
                    <Th isNumeric>Saldo folios</Th>
                    <Th>Cerrado</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {closeItems.map((close) => (
                    <Tr key={close.id}>
                      <Td>{formatCalendarDate(close.operationalDate)}</Td>
                      <Td>
                        <StatusBadge
                          color={OPERATIONAL_CLOSE_COLORS[close.status]}
                          label={OPERATIONAL_CLOSE_LABELS[close.status]}
                        />
                      </Td>
                      <Td>{close.snapshot.forced ? 'Sí' : 'No'}</Td>
                      <Td isNumeric>
                        {formatMoney(
                          close.snapshot.totals.openFolioBalance,
                          close.snapshot.currencyCode,
                        )}
                      </Td>
                      <Td>{formatDateTime(close.closedAt)}</Td>
                      <Td isNumeric>
                        {close.status === 'CLOSED' && (
                          <Button size="xs" variant="ghost" onClick={() => openReopen(close)}>
                            Reabrir
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </QueryFeedback>
        </SectionCard>
      </SimpleGrid>

      <Modal isOpen={reopenModal.isOpen} onClose={reopenModal.onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={submitReopen}>
          <ModalHeader>Reabrir día operativo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="textSecondary">
                Vas a reabrir el cierre de{' '}
                {reopenTarget === null ? '—' : formatCalendarDate(reopenTarget.operationalDate)}. La
                acción queda auditada con el motivo.
              </Text>
              <Field label="Motivo" isRequired error={errors['reopen.reason']}>
                <Textarea
                  value={reopenReason}
                  onChange={(event) => setReopenReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={reopenModal.onClose}>
              Volver
            </Button>
            <Button type="submit" colorScheme="warning" isLoading={busy === 'reopen'}>
              Reabrir día
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function CashierPage() {
  return (
    <PropertyGate>
      <CashierContent />
    </PropertyGate>
  );
}
