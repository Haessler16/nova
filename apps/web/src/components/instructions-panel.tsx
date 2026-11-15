'use client';

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  INSTRUCTION_ACTION_LABELS,
  INSTRUCTION_CATEGORY_LABELS,
  INSTRUCTION_MOMENT_LABELS,
  INSTRUCTION_PRIORITY_COLORS,
  INSTRUCTION_PRIORITY_LABELS,
  INSTRUCTION_STATUS_COLORS,
  INSTRUCTION_STATUS_LABELS,
  formatDateTime,
} from '@/lib/format';
import type {
  InstructionCategory,
  InstructionPriority,
  InstructionStatus,
  ParsedInstructionSuggestion,
  ReservationInstruction,
  ReservationSourceNote,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { Field, QueryFeedback, SectionCard, StatusBadge } from './ui';

interface InstructionsPanelProps {
  reservationId: string;
  /** Hide mutating controls for read-only roles. The API still enforces RBAC. */
  canManage: boolean;
  onChanged?: () => void;
}

const CATEGORY_OPTIONS: InstructionCategory[] = [
  'GENERAL',
  'PAYMENT',
  'MEAL',
  'BILLING',
  'ROOM',
  'ARRIVAL',
  'IMPORTANT',
  'EXTRA',
  'CONFIDENTIAL',
];

const PRIORITY_OPTIONS: InstructionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

const STATUS_ACTIONS: Array<{
  status: InstructionStatus;
  label: string;
  path: string;
  variant?: 'solid' | 'outline' | 'ghost';
}> = [
  { status: 'ACKNOWLEDGED', label: 'Reconocer', path: 'acknowledge', variant: 'outline' },
  { status: 'IN_PROGRESS', label: 'Iniciar', path: 'start', variant: 'outline' },
  { status: 'COMPLETED', label: 'Completar', path: 'complete' },
  { status: 'DISMISSED', label: 'Descartar', path: 'dismiss', variant: 'ghost' },
];

function canTransition(from: InstructionStatus, to: InstructionStatus): boolean {
  switch (from) {
    case 'NEW':
      return true;
    case 'ACKNOWLEDGED':
      return to !== 'ACKNOWLEDGED';
    case 'IN_PROGRESS':
      return to === 'COMPLETED' || to === 'DISMISSED' || to === 'NEEDS_CLARIFICATION';
    case 'NEEDS_CLARIFICATION':
      return to === 'ACKNOWLEDGED' || to === 'DISMISSED' || to === 'IN_PROGRESS';
    case 'COMPLETED':
    case 'DISMISSED':
      return false;
    default:
      return false;
  }
}

export function ReservationInstructions({
  reservationId,
  canManage,
  onChanged,
}: InstructionsPanelProps) {
  const { tenant } = useSession();
  const toast = useToast();

  const [showCompleted, setShowCompleted] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parsed, setParsed] = useState<{
    sourceNoteId: string;
    suggestions: ParsedInstructionSuggestion[];
    warnings: string[];
    redacted: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const createModal = useDisclosure();
  const [newInstruction, setNewInstruction] = useState({
    category: 'GENERAL' as InstructionCategory,
    priority: 'NORMAL' as InstructionPriority,
    title: '',
    body: '',
  });

  const list = useAsyncData<{ items: ReservationInstruction[] }>(
    () =>
      api<{ items: ReservationInstruction[] }>(
        `/api/v1/reservations/${reservationId}/instructions?limit=100${
          showCompleted ? '&includeCompleted=true' : ''
        }`,
        { tenant },
      ),
    `${reservationId}:${String(showCompleted)}`,
  );

  const sourceNotes = useAsyncData<{ items: ReservationSourceNote[] }>(
    () =>
      api<{ items: ReservationSourceNote[] }>(
        `/api/v1/reservations/${reservationId}/source-notes`,
        { tenant },
      ),
    `${reservationId}:source-notes`,
  );

  function notifyChanged(): void {
    list.reload();
    sourceNotes.reload();
    onChanged?.();
  }

  async function handleParse(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (sourceText.trim().length === 0) {
      return;
    }
    setParsing(true);
    try {
      const note = await api<ReservationSourceNote>(
        `/api/v1/reservations/${reservationId}/source-notes/parse`,
        {
          method: 'POST',
          tenant,
          body: { text: sourceText, sourceSystem: 'MANUAL' },
        },
      );
      setParsed({
        sourceNoteId: note.id,
        suggestions: note.suggestions,
        warnings: note.warnings,
        redacted: note.redacted,
      });
      setSelected(new Set(note.suggestions.map((_item, index) => index)));
      setSourceText('');
      sourceNotes.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo interpretar la observación',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (parsed === null) {
      return;
    }
    const suggestions = parsed.suggestions.filter((_suggestion, index) => selected.has(index));
    if (suggestions.length === 0) {
      return;
    }
    setConfirming(true);
    try {
      const result = await api<{ created: ReservationInstruction[]; skipped: number }>(
        `/api/v1/reservations/${reservationId}/source-notes/${parsed.sourceNoteId}/confirm`,
        {
          method: 'POST',
          tenant,
          body: { suggestions },
        },
      );
      toast({
        title: `Instrucciones confirmadas: ${result.created.length}`,
        description:
          result.skipped > 0
            ? `${result.skipped} ya existían y no se duplicaron.`
            : 'Ningún pago, cargo o tarifa fue modificado.',
        status: 'success',
      });
      setParsed(null);
      setSelected(new Set());
      notifyChanged();
    } catch (cause) {
      toast({
        title: 'No se pudieron confirmar las sugerencias',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setConfirming(false);
    }
  }

  async function handleTransition(
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ): Promise<void> {
    setBusyAction(`${instruction.id}:${status}`);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions/${instruction.id}/${path}`, {
        method: 'POST',
        tenant,
        body: {},
      });
      notifyChanged();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar la instrucción',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions`, {
        method: 'POST',
        tenant,
        body: {
          category: newInstruction.category,
          priority: newInstruction.priority,
          title: newInstruction.title.trim(),
          body: newInstruction.body.trim(),
        },
      });
      setNewInstruction({
        category: 'GENERAL',
        priority: 'NORMAL',
        title: '',
        body: '',
      });
      createModal.onClose();
      notifyChanged();
    } catch (cause) {
      toast({
        title: 'No se pudo crear la instrucción',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    }
  }

  const pending = (list.data?.items ?? []).filter(
    (instruction) => instruction.status !== 'COMPLETED' && instruction.status !== 'DISMISSED',
  );

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={3} wrap="wrap">
        <Text fontWeight="semibold">Notas e instrucciones</Text>
        <HStack spacing={2}>
          <Checkbox
            size="sm"
            isChecked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          >
            Ver cerradas
          </Checkbox>
          {canManage && (
            <Button size="xs" variant="outline" onClick={createModal.onOpen}>
              Nueva
            </Button>
          )}
        </HStack>
      </HStack>
      <Stack spacing={4}>
        <QueryFeedback
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          isEmpty={pending.length === 0}
          emptyText="Sin instrucciones pendientes."
        >
          <Stack spacing={3}>
            {(list.data?.items ?? []).map((instruction) => (
              <Box
                key={instruction.id}
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="md"
                p={3}
              >
                <HStack justify="space-between" align="start" wrap="wrap">
                  <Box>
                    <HStack spacing={2} wrap="wrap">
                      <StatusBadge
                        color={INSTRUCTION_PRIORITY_COLORS[instruction.priority]}
                        label={INSTRUCTION_PRIORITY_LABELS[instruction.priority]}
                      />
                      <Badge colorScheme="gray">
                        {INSTRUCTION_CATEGORY_LABELS[instruction.category]}
                      </Badge>
                      {instruction.category === 'CONFIDENTIAL' && (
                        <Badge colorScheme="danger" textTransform="none">
                          Confidencial
                        </Badge>
                      )}
                      {instruction.actionType !== null && (
                        <Badge colorScheme="brand" textTransform="none">
                          {INSTRUCTION_ACTION_LABELS[instruction.actionType]}
                        </Badge>
                      )}
                      {instruction.executionMoment !== null && (
                        <Badge colorScheme="gray" textTransform="none">
                          {INSTRUCTION_MOMENT_LABELS[instruction.executionMoment]}
                        </Badge>
                      )}
                    </HStack>
                    <Text fontWeight="semibold" mt={1}>
                      {instruction.title}
                    </Text>
                  </Box>
                  <StatusBadge
                    color={INSTRUCTION_STATUS_COLORS[instruction.status]}
                    label={INSTRUCTION_STATUS_LABELS[instruction.status]}
                  />
                </HStack>
                <Text fontSize="sm" mt={2} whiteSpace="pre-wrap">
                  {instruction.body}
                </Text>
                {instruction.actionType === 'PAYMENT_PREAUTHORIZATION' && (
                  <Text fontSize="xs" color="warning.600" mt={2}>
                    Pendiente de preautorización. No es un pago realizado; iniciarla exige el flujo
                    de pagos con importe confirmado.
                  </Text>
                )}
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {instruction.assignedDepartment !== null
                    ? `${instruction.assignedDepartment} · `
                    : ''}
                  {INSTRUCTION_STATUS_LABELS[instruction.status]} ·{' '}
                  {formatDateTime(instruction.createdAt)}
                </Text>
                {canManage && canTransition(instruction.status, 'COMPLETED') && (
                  <HStack mt={3} spacing={2} wrap="wrap">
                    {STATUS_ACTIONS.filter((action) =>
                      canTransition(instruction.status, action.status),
                    ).map((action) => (
                      <Button
                        key={action.path}
                        size="xs"
                        variant={action.variant ?? 'outline'}
                        colorScheme={action.status === 'DISMISSED' ? 'gray' : 'brand'}
                        isLoading={busyAction === `${instruction.id}:${action.status}`}
                        onClick={() =>
                          void handleTransition(instruction, action.path, action.status)
                        }
                      >
                        {action.label}
                      </Button>
                    ))}
                  </HStack>
                )}
              </Box>
            ))}
          </Stack>
        </QueryFeedback>

        <Divider />

        <Box>
          <Text fontWeight="semibold">Importar observación original</Text>
          <Text fontSize="xs" color="gray.500" mb={2}>
            El parser solo sugiere. Requiere confirmación humana y nunca crea pagos, cargos, tarifas
            ni asignaciones. Los datos de tarjeta se redactan antes de guardar.
          </Text>
          {canManage ? (
            <Box as="form" onSubmit={(event) => void handleParse(event)}>
              <Textarea
                rows={3}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Ej.: RSV COM CAFE / PGTO DIRETO NO HOTEL (12-15/11)"
              />
              <Button
                mt={2}
                size="sm"
                colorScheme="brand"
                type="submit"
                isLoading={parsing}
                isDisabled={sourceText.trim().length === 0}
              >
                Interpretar
              </Button>
            </Box>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Tu rol no puede importar observaciones.
            </Text>
          )}
        </Box>

        {parsed !== null && (
          <Box borderWidth="1px" borderColor="brand.200" borderRadius="md" p={3}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Sugerencias del parser</Text>
              <Badge colorScheme="brand">{parsed.suggestions.length}</Badge>
            </HStack>
            {parsed.redacted && (
              <Text fontSize="xs" color="warning.600" mt={1}>
                Se redactaron datos de tarjeta del texto original.
              </Text>
            )}
            {parsed.warnings.map((warning) => (
              <Text key={warning} fontSize="xs" color="gray.600" mt={1}>
                · {warning}
              </Text>
            ))}
            <Stack spacing={2} mt={3}>
              {parsed.suggestions.map((suggestion, index) => (
                <Box key={`${suggestion.title}:${index}`} borderTopWidth="1px" pt={2}>
                  <Checkbox
                    isChecked={selected.has(index)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) {
                        next.add(index);
                      } else {
                        next.delete(index);
                      }
                      setSelected(next);
                    }}
                  >
                    <Text as="span" fontWeight="semibold">
                      {suggestion.title}
                    </Text>
                  </Checkbox>
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    {suggestion.body}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    «{suggestion.sourcePhrase}» · confianza{' '}
                    {Math.round(suggestion.confidence * 100)}%
                  </Text>
                </Box>
              ))}
            </Stack>
            <HStack mt={3} spacing={2}>
              <Button
                size="sm"
                colorScheme="brand"
                isLoading={confirming}
                isDisabled={selected.size === 0}
                onClick={() => void handleConfirm()}
              >
                Confirmar seleccionadas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setParsed(null)}>
                Cancelar
              </Button>
            </HStack>
          </Box>
        )}

        {(sourceNotes.data?.items.length ?? 0) > 0 && (
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Texto original preservado
            </Text>
            <Stack spacing={2} maxH="220px" overflowY="auto">
              {sourceNotes.data?.items.map((note) => (
                <Box key={note.id} borderLeftWidth="3px" borderColor="gray.200" pl={3}>
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {note.sourceTextOriginal}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {note.parserVersion} · {formatDateTime(note.importedAt)}
                    {note.redacted ? ' · datos de tarjeta redactados' : ''}
                  </Text>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreate(event)}>
          <ModalHeader>Nueva instrucción</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Field label="Título" isRequired>
                <Textarea
                  rows={1}
                  value={newInstruction.title}
                  onChange={(event) =>
                    setNewInstruction({ ...newInstruction, title: event.target.value })
                  }
                />
              </Field>
              <Field label="Detalle" isRequired>
                <Textarea
                  rows={3}
                  value={newInstruction.body}
                  onChange={(event) =>
                    setNewInstruction({ ...newInstruction, body: event.target.value })
                  }
                />
              </Field>
              <Field label="Categoría">
                <Select
                  value={newInstruction.category}
                  onChange={(event) =>
                    setNewInstruction({
                      ...newInstruction,
                      category: event.target.value as InstructionCategory,
                    })
                  }
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {INSTRUCTION_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioridad">
                <Select
                  value={newInstruction.priority}
                  onChange={(event) =>
                    setNewInstruction({
                      ...newInstruction,
                      priority: event.target.value as InstructionPriority,
                    })
                  }
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {INSTRUCTION_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              colorScheme="brand"
              isDisabled={
                newInstruction.title.trim().length < 2 || newInstruction.body.trim().length < 2
              }
            >
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SectionCard>
  );
}
