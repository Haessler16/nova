'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
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
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import {
  Field,
  MetricCard,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  FOLIO_STATUS_COLORS,
  FOLIO_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type { Folio, FolioLine, PaymentStatus } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de crédito' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de débito' },
  { value: 'BANK_TRANSFER', label: 'Transferencia bancaria' },
  { value: 'OTHER', label: 'Otro' },
] as const;

function FolioDetailContent() {
  const params = useParams<{ id: string | string[] }>();
  const folioId = Array.isArray(params.id) ? (params.id[0] ?? '') : params.id;
  const { tenant } = useSession();
  const toast = useToast();

  const folio = useAsyncData<Folio>(
    () => api<Folio>(`/api/v1/folios/${folioId}`, { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:folio:${folioId}`,
  );

  const voidModal = useDisclosure();
  const cancelModal = useDisclosure();

  const [busy, setBusy] = useState<string | null>(null);
  const [charge, setCharge] = useState({ description: '', amount: '' });
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', referenceId: '' });
  const [voidTarget, setVoidTarget] = useState<FolioLine | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  async function run(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
    after?: () => void,
  ): Promise<void> {
    setBusy(key);
    try {
      await action();
      toast({ title: successMessage, status: 'success' });
      after?.();
      folio.reload();
    } catch (cause) {
      toast({
        title: 'La operación no se completó',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitCharge(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(
      'charge',
      () =>
        api(`/api/v1/folios/${folioId}/charges`, {
          method: 'POST',
          tenant,
          body: {
            description: charge.description,
            amount: charge.amount,
            idempotencyKey: `charge-ui-${crypto.randomUUID()}`,
          },
        }),
      'Cargo registrado',
      () => setCharge({ description: '', amount: '' }),
    );
  }

  async function submitPayment(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(
      'payment',
      () =>
        api(`/api/v1/folios/${folioId}/payments`, {
          method: 'POST',
          tenant,
          body: {
            amount: payment.amount,
            method: payment.method,
            ...(payment.referenceId.trim() !== ''
              ? { referenceId: payment.referenceId.trim() }
              : {}),
            idempotencyKey: `payment-ui-${crypto.randomUUID()}`,
          },
        }),
      'Pago registrado',
      () => setPayment({ amount: '', method: 'CASH', referenceId: '' }),
    );
  }

  function openVoid(line: FolioLine): void {
    setVoidTarget(line);
    setVoidReason('');
    voidModal.onOpen();
  }

  async function submitVoid(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (voidTarget === null) return;
    await run(
      'void',
      () =>
        api(`/api/v1/folios/${folioId}/charges/${voidTarget.id}/void`, {
          method: 'POST',
          tenant,
          body: {
            reason: voidReason,
            idempotencyKey: `void-ui-${crypto.randomUUID()}`,
          },
        }),
      'Cargo anulado',
      () => voidModal.onClose(),
    );
  }

  async function submitCancel(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(
      'cancel',
      () =>
        api(`/api/v1/folios/${folioId}/cancel`, {
          method: 'POST',
          tenant,
          body: {
            reason: cancelReason,
            idempotencyKey: `cancel-ui-${crypto.randomUUID()}`,
          },
        }),
      'Folio cancelado',
      () => cancelModal.onClose(),
    );
  }

  const data = folio.data;
  const isOpen = data?.status === 'OPEN';
  const hasPayments = (data?.payments.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Folio"
        title={data?.number ?? 'Folio'}
        description={
          data === null
            ? 'Cargando la cuenta…'
            : `Reserva ${data.reservationId?.slice(0, 8) ?? '—'} · moneda ${data.currencyCode}`
        }
        actions={
          <HStack spacing={2}>
            <Button as={NextLink} href="/folios" variant="outline">
              Volver
            </Button>
            {data !== null && isOpen && !hasPayments && (
              <Button colorScheme="danger" variant="outline" onClick={cancelModal.onOpen}>
                Cancelar folio
              </Button>
            )}
          </HStack>
        }
      />

      <QueryFeedback loading={folio.loading} error={folio.error} onRetry={folio.reload}>
        {data !== null && (
          <Stack spacing={5}>
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
              <MetricCard
                label="Cargos"
                value={formatMoney(data.totals.charges, data.currencyCode)}
                accent="sky"
              />
              <MetricCard
                label="Pagos"
                value={formatMoney(data.totals.payments, data.currencyCode)}
                accent="mint"
              />
              <MetricCard
                label="Saldo"
                value={formatMoney(data.totals.balance, data.currencyCode)}
                accent={data.totals.balance === '0.00' ? 'mint' : 'warning'}
              />
              <MetricCard
                label="Estado"
                value={
                  <StatusBadge
                    color={FOLIO_STATUS_COLORS[data.status]}
                    label={FOLIO_STATUS_LABELS[data.status]}
                  />
                }
                hint={`Abierto ${formatDateTime(data.createdAt)}`}
                accent="brand"
              />
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start">
              <SectionCard>
                <HStack justify="space-between" mb={3}>
                  <Text fontWeight="semibold">Cargos</Text>
                  <Badge colorScheme="sky">{data.lines.length}</Badge>
                </HStack>
                {data.lines.length === 0 ? (
                  <Text fontSize="sm" color="textSecondary">
                    Todavía no hay cargos.
                  </Text>
                ) : (
                  <TableContainer>
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Concepto</Th>
                          <Th isNumeric>Importe</Th>
                          <Th>Estado</Th>
                          <Th />
                        </Tr>
                      </Thead>
                      <Tbody>
                        {data.lines.map((line) => (
                          <Tr key={line.id} opacity={line.status === 'VOID' ? 0.6 : 1}>
                            <Td>
                              <Text fontSize="sm">{line.description}</Text>
                              <Text fontSize="xs" color="textSecondary">
                                {formatDateTime(line.postedAt)}
                              </Text>
                            </Td>
                            <Td isNumeric>{formatMoney(line.amount, line.currencyCode)}</Td>
                            <Td>
                              <StatusBadge
                                color={line.status === 'POSTED' ? 'mint' : 'danger'}
                                label={line.status === 'POSTED' ? 'Posteado' : 'Anulado'}
                              />
                            </Td>
                            <Td isNumeric>
                              {isOpen && line.status === 'POSTED' && (
                                <Button size="xs" variant="ghost" onClick={() => openVoid(line)}>
                                  Anular
                                </Button>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}

                {isOpen && (
                  <>
                    <Divider my={4} />
                    <Box as="form" onSubmit={submitCharge}>
                      <Stack spacing={3}>
                        <Field label="Concepto" isRequired>
                          <Input
                            size="sm"
                            value={charge.description}
                            maxLength={120}
                            onChange={(event) =>
                              setCharge((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            required
                          />
                        </Field>
                        <Field
                          label={`Importe (${data.currencyCode})`}
                          isRequired
                          helper="Hasta dos decimales. Ejemplo: 150.00"
                        >
                          <Input
                            size="sm"
                            inputMode="decimal"
                            value={charge.amount}
                            onChange={(event) =>
                              setCharge((current) => ({ ...current, amount: event.target.value }))
                            }
                            required
                          />
                        </Field>
                        <Button
                          type="submit"
                          size="sm"
                          colorScheme="brand"
                          isLoading={busy === 'charge'}
                        >
                          Registrar cargo
                        </Button>
                      </Stack>
                    </Box>
                  </>
                )}
              </SectionCard>

              <SectionCard>
                <HStack justify="space-between" mb={3}>
                  <Text fontWeight="semibold">Pagos</Text>
                  <Badge colorScheme="mint">{data.payments.length}</Badge>
                </HStack>
                {data.payments.length === 0 ? (
                  <Text fontSize="sm" color="textSecondary">
                    Todavía no hay pagos.
                  </Text>
                ) : (
                  <TableContainer>
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Método</Th>
                          <Th isNumeric>Importe</Th>
                          <Th>Estado</Th>
                          <Th>Recibido</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {data.payments.map((item) => (
                          <Tr key={item.id}>
                            <Td>
                              <Text fontSize="sm">{item.method}</Text>
                              {item.referenceId !== null && (
                                <Text fontSize="xs" color="textSecondary">
                                  Ref. {item.referenceId}
                                </Text>
                              )}
                            </Td>
                            <Td isNumeric>{formatMoney(item.amount, item.currencyCode)}</Td>
                            <Td>
                              <StatusBadge
                                color={PAYMENT_STATUS_COLORS[item.status as PaymentStatus]}
                                label={PAYMENT_STATUS_LABELS[item.status as PaymentStatus]}
                              />
                            </Td>
                            <Td>{formatDateTime(item.receivedAt)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}

                {isOpen && (
                  <>
                    <Divider my={4} />
                    <Box as="form" onSubmit={submitPayment}>
                      <Stack spacing={3}>
                        <Field
                          label={`Importe (${data.currencyCode})`}
                          isRequired
                          helper="No se aceptan importes superiores al saldo."
                        >
                          <Input
                            size="sm"
                            inputMode="decimal"
                            value={payment.amount}
                            onChange={(event) =>
                              setPayment((current) => ({ ...current, amount: event.target.value }))
                            }
                            required
                          />
                        </Field>
                        <Field label="Método" isRequired>
                          <Select
                            size="sm"
                            value={payment.method}
                            onChange={(event) =>
                              setPayment((current) => ({ ...current, method: event.target.value }))
                            }
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method.value} value={method.value}>
                                {method.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field
                          label="Referencia externa"
                          helper="Opcional. Usá sólo un identificador tokenizado, sin PAN ni CVV."
                        >
                          <Input
                            size="sm"
                            value={payment.referenceId}
                            maxLength={64}
                            onChange={(event) =>
                              setPayment((current) => ({
                                ...current,
                                referenceId: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Button
                          type="submit"
                          size="sm"
                          colorScheme="brand"
                          isLoading={busy === 'payment'}
                        >
                          Registrar pago
                        </Button>
                      </Stack>
                    </Box>
                  </>
                )}

                {!isOpen && (
                  <Text fontSize="xs" color="textSecondary" mt={4}>
                    Este folio está {FOLIO_STATUS_LABELS[data.status].toLowerCase()} y ya no acepta
                    movimientos.
                  </Text>
                )}
              </SectionCard>
            </SimpleGrid>
          </Stack>
        )}
      </QueryFeedback>

      <Modal isOpen={voidModal.isOpen} onClose={voidModal.onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={submitVoid}>
          <ModalHeader>Anular cargo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm">
                {voidTarget?.description} · {formatMoney(voidTarget?.amount, data?.currencyCode)}
              </Text>
              <Field label="Motivo" isRequired>
                <Textarea
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={voidModal.onClose}>
              Cerrar
            </Button>
            <Button type="submit" colorScheme="danger" isLoading={busy === 'void'}>
              Anular cargo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={cancelModal.isOpen} onClose={cancelModal.onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={submitCancel}>
          <ModalHeader>Cancelar folio</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="textSecondary">
                Sólo se puede cancelar un folio sin pagos registrados.
              </Text>
              <Field label="Motivo" isRequired>
                <Textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={cancelModal.onClose}>
              Volver
            </Button>
            <Button type="submit" colorScheme="danger" isLoading={busy === 'cancel'}>
              Cancelar folio
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function FolioDetailPage() {
  return (
    <PropertyGate>
      <FolioDetailContent />
    </PropertyGate>
  );
}
