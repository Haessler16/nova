'use client';

import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
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
  INSTRUCTION_VISIBILITY_LABELS,
  formatDateTime,
} from '@/lib/format';
import type {
  InstructionActionType,
  InstructionCategory,
  InstructionEvent,
  InstructionExecutionMoment,
  InstructionPriority,
  InstructionStatus,
  InstructionVisibility,
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
const VISIBILITY_OPTIONS: InstructionVisibility[] = [
  'ALL_AUTHORIZED',
  'FRONT_DESK',
  'RESERVATIONS',
  'FINANCE',
  'MANAGEMENT',
];
const ACTION_OPTIONS: InstructionActionType[] = [
  'PAYMENT_PREAUTHORIZATION',
  'VERIFY_PAYMENT',
  'BILLING_TASK',
  'ARRIVAL_REMINDER',
];
const MOMENT_OPTIONS: InstructionExecutionMoment[] = [
  'PRE_ARRIVAL',
  'CHECK_IN',
  'DURING_STAY',
  'CHECK_OUT',
];

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

const EVENT_LABELS: Record<InstructionEvent['eventType'], string> = {
  CREATED: 'Creada',
  UPDATED: 'Editada',
  ACKNOWLEDGED: 'Reconocida',
  IN_PROGRESS: 'Iniciada',
  COMPLETED: 'Completada',
  DISMISSED: 'Descartada',
  NEEDS_CLARIFICATION: 'Necesita aclaración',
  CONFIRMED_FROM_SOURCE: 'Confirmada desde texto original',
};

function toDateTimeLocal(value: string | null): string {
  if (value === null) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .slice(0, 10);
}

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

interface InstructionCardProps {
  instruction: ReservationInstruction;
  canManage: boolean;
  busyAction: string | null;
  events: InstructionEvent[] | undefined;
  eventsLoading: boolean;
  onTransition: (
    instruction: ReservationInstruction,
    path: string,
    status: InstructionStatus,
  ) => void;
  onToggleEvents: (instruction: ReservationInstruction) => void;
  onEdit: (instruction: ReservationInstruction) => void;
}

function InstructionCard({
  instruction,
  canManage,
  busyAction,
  events,
  eventsLoading,
  onTransition,
  onToggleEvents,
  onEdit,
}: InstructionCardProps) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
      <HStack justify="space-between" align="start" wrap="wrap">
        <Box>
          <HStack spacing={2} wrap="wrap">
            <StatusBadge
              color={INSTRUCTION_PRIORITY_COLORS[instruction.priority]}
              label={INSTRUCTION_PRIORITY_LABELS[instruction.priority]}
            />
            <Badge colorScheme="gray">{INSTRUCTION_CATEGORY_LABELS[instruction.category]}</Badge>
            {instruction.tags.map((tag) => (
              <Badge key={tag} colorScheme="purple" variant="subtle" textTransform="none">
                {tag}
              </Badge>
            ))}
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
            {instruction.visibility !== 'ALL_AUTHORIZED' && (
              <Badge colorScheme="gray" textTransform="none">
                {INSTRUCTION_VISIBILITY_LABELS[instruction.visibility]}
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
        <Alert status="warning" mt={2} borderRadius="md" py={1}>
          <AlertIcon />
          <Text fontSize="xs">
            Pendiente de preautorización. No es un pago realizado ni una autorización aprobada;
            iniciarla exige el módulo de pagos con importe confirmado y token del proveedor.
          </Text>
        </Alert>
      )}
      <Text fontSize="xs" color="gray.500" mt={1}>
        {instruction.assignedDepartment !== null ? `${instruction.assignedDepartment} · ` : ''}
        {INSTRUCTION_STATUS_LABELS[instruction.status]} · {formatDateTime(instruction.createdAt)}
      </Text>
      {(instruction.validFrom !== null || instruction.validUntil !== null) && (
        <Text fontSize="xs" color="gray.500">
          Vigencia: {instruction.validFrom !== null ? formatDateTime(instruction.validFrom) : '—'} →{' '}
          {instruction.validUntil !== null ? formatDateTime(instruction.validUntil) : '—'}
        </Text>
      )}

      <HStack mt={3} spacing={2} wrap="wrap">
        {canManage && canTransition(instruction.status, 'COMPLETED') && (
          <>
            {STATUS_ACTIONS.filter((action) =>
              canTransition(instruction.status, action.status),
            ).map((action) => (
              <Button
                key={action.path}
                size="xs"
                variant={action.variant ?? 'outline'}
                colorScheme={action.status === 'DISMISSED' ? 'gray' : 'brand'}
                isLoading={busyAction === `${instruction.id}:${action.status}`}
                onClick={() => onTransition(instruction, action.path, action.status)}
              >
                {action.label}
              </Button>
            ))}
            <Button size="xs" variant="ghost" onClick={() => onEdit(instruction)}>
              Editar
            </Button>
          </>
        )}
        <Button
          size="xs"
          variant="ghost"
          isLoading={eventsLoading}
          onClick={() => onToggleEvents(instruction)}
        >
          {events === undefined ? 'Historial' : 'Ocultar historial'}
        </Button>
      </HStack>

      {events !== undefined && (
        <Box mt={3} borderLeftWidth="3px" borderColor="gray.200" pl={3}>
          {events.length === 0 ? (
            <Text fontSize="xs" color="gray.500">
              Sin eventos.
            </Text>
          ) : (
            <Stack spacing={1}>
              {events.map((event) => (
                <Text key={event.id} fontSize="xs" color="gray.600">
                  {formatDateTime(event.occurredAt)} · {EVENT_LABELS[event.eventType]}
                  {event.fromStatus !== null && event.toStatus !== null
                    ? ` (${INSTRUCTION_STATUS_LABELS[event.fromStatus]} → ${
                        INSTRUCTION_STATUS_LABELS[event.toStatus]
                      })`
                    : ''}
                  {event.reason !== null ? ` · ${event.reason}` : ''}
                </Text>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

export function ReservationInstructions({
  reservationId,
  canManage,
  onChanged,
}: InstructionsPanelProps) {
  const { tenant } = useSession();
  const toast = useToast();

  const [showCompleted, setShowCompleted] = useState(false);
  const [showSourceText, setShowSourceText] = useState(false);
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
  const [events, setEvents] = useState<Record<string, InstructionEvent[]>>({});
  const [eventsLoading, setEventsLoading] = useState<string | null>(null);

  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const [saving, setSaving] = useState(false);
  const [newInstruction, setNewInstruction] = useState({
    category: 'GENERAL' as InstructionCategory,
    priority: 'NORMAL' as InstructionPriority,
    visibility: 'ALL_AUTHORIZED' as InstructionVisibility,
    title: '',
    body: '',
    tags: '',
    assignedDepartment: '',
    actionType: '' as '' | InstructionActionType,
    executionMoment: '' as '' | InstructionExecutionMoment,
    validFrom: '',
    validUntil: '',
  });
  const [editTarget, setEditTarget] = useState<ReservationInstruction | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    body: '',
    tags: '',
    priority: 'NORMAL' as InstructionPriority,
    visibility: 'ALL_AUTHORIZED' as InstructionVisibility,
    assignedDepartment: '',
    validFrom: '',
    validUntil: '',
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
    // Cached timelines may be stale after a transition or edit.
    setEvents({});
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
    setSaving(true);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions`, {
        method: 'POST',
        tenant,
        body: {
          category: newInstruction.category,
          priority: newInstruction.priority,
          visibility: newInstruction.visibility,
          title: newInstruction.title.trim(),
          body: newInstruction.body.trim(),
          tags: splitTags(newInstruction.tags),
          ...(newInstruction.assignedDepartment.trim() !== ''
            ? { assignedDepartment: newInstruction.assignedDepartment.trim() }
            : {}),
          ...(newInstruction.actionType !== '' ? { actionType: newInstruction.actionType } : {}),
          ...(newInstruction.executionMoment !== ''
            ? { executionMoment: newInstruction.executionMoment }
            : {}),
          ...(newInstruction.validFrom !== ''
            ? { validFrom: new Date(newInstruction.validFrom).toISOString() }
            : {}),
          ...(newInstruction.validUntil !== ''
            ? { validUntil: new Date(newInstruction.validUntil).toISOString() }
            : {}),
        },
      });
      setNewInstruction({
        category: 'GENERAL',
        priority: 'NORMAL',
        visibility: 'ALL_AUTHORIZED',
        title: '',
        body: '',
        tags: '',
        assignedDepartment: '',
        actionType: '',
        executionMoment: '',
        validFrom: '',
        validUntil: '',
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
    } finally {
      setSaving(false);
    }
  }

  function openEdit(instruction: ReservationInstruction): void {
    setEditTarget(instruction);
    setEditForm({
      title: instruction.title,
      body: instruction.body,
      tags: instruction.tags.join(', '),
      priority: instruction.priority,
      visibility: instruction.visibility,
      assignedDepartment: instruction.assignedDepartment ?? '',
      validFrom: toDateTimeLocal(instruction.validFrom),
      validUntil: toDateTimeLocal(instruction.validUntil),
    });
    editModal.onOpen();
  }

  async function handleEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (editTarget === null) {
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/reservations/${reservationId}/instructions/${editTarget.id}`, {
        method: 'PATCH',
        tenant,
        body: {
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          tags: splitTags(editForm.tags),
          priority: editForm.priority,
          visibility: editForm.visibility,
          assignedDepartment: editForm.assignedDepartment.trim(),
          ...(editForm.validFrom !== ''
            ? { validFrom: new Date(editForm.validFrom).toISOString() }
            : {}),
          ...(editForm.validUntil !== ''
            ? { validUntil: new Date(editForm.validUntil).toISOString() }
            : {}),
        },
      });
      editModal.onClose();
      setEditTarget(null);
      notifyChanged();
    } catch (cause) {
      toast({
        title: 'No se pudo editar la instrucción',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEvents(instruction: ReservationInstruction): Promise<void> {
    if (events[instruction.id] !== undefined) {
      setEvents((current) => {
        const next = { ...current };
        delete next[instruction.id];
        return next;
      });
      return;
    }
    setEventsLoading(instruction.id);
    try {
      const result = await api<{ items: InstructionEvent[] }>(
        `/api/v1/reservations/${reservationId}/instructions/${instruction.id}/events`,
        { tenant },
      );
      setEvents((current) => ({ ...current, [instruction.id]: result.items }));
    } catch (cause) {
      toast({
        title: 'No se pudo cargar el historial',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setEventsLoading(null);
    }
  }

  const items = list.data?.items ?? [];
  const actions = items.filter((instruction) => instruction.actionType !== null);
  const information = items.filter((instruction) => instruction.actionType === null);
  const highlighted = items.filter(
    (instruction) => instruction.priority === 'HIGH' || instruction.priority === 'CRITICAL',
  );
  const pendingCount = items.filter(
    (instruction) => instruction.status !== 'COMPLETED' && instruction.status !== 'DISMISSED',
  ).length;

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={3} wrap="wrap">
        <Box>
          <Text fontWeight="semibold">Notas e instrucciones</Text>
          <Text fontSize="xs" color="gray.500">
            {pendingCount === 0
              ? 'Sin pendientes.'
              : `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}.`}
          </Text>
        </Box>
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

      {highlighted.length > 0 && (
        <Alert status="warning" borderRadius="md" mb={3}>
          <AlertIcon />
          <Text fontSize="sm">
            {highlighted.length} instrucción{highlighted.length === 1 ? '' : 'es'} de prioridad alta
            o crítica requiere revisión operativa.
          </Text>
        </Alert>
      )}

      <QueryFeedback
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        isEmpty={items.length === 0}
        emptyText="Sin notas ni instrucciones registradas."
      >
        <Stack spacing={4}>
          <Box>
            <Text fontWeight="semibold" fontSize="sm" mb={2}>
              Acciones pendientes
            </Text>
            {actions.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                Sin acciones por ejecutar.
              </Text>
            ) : (
              <Stack spacing={3}>
                {actions.map((instruction) => (
                  <InstructionCard
                    key={instruction.id}
                    instruction={instruction}
                    canManage={canManage}
                    busyAction={busyAction}
                    events={events[instruction.id]}
                    eventsLoading={eventsLoading === instruction.id}
                    onTransition={(item, path, status) => void handleTransition(item, path, status)}
                    onToggleEvents={(item) => void toggleEvents(item)}
                    onEdit={openEdit}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Box>
            <Text fontWeight="semibold" fontSize="sm" mb={2}>
              Información
            </Text>
            {information.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                Sin notas informativas.
              </Text>
            ) : (
              <Stack spacing={3}>
                {information.map((instruction) => (
                  <InstructionCard
                    key={instruction.id}
                    instruction={instruction}
                    canManage={canManage}
                    busyAction={busyAction}
                    events={events[instruction.id]}
                    eventsLoading={eventsLoading === instruction.id}
                    onTransition={(item, path, status) => void handleTransition(item, path, status)}
                    onToggleEvents={(item) => void toggleEvents(item)}
                    onEdit={openEdit}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </QueryFeedback>

      <Divider my={4} />

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
              placeholder="Ej.: RSV COM CAFE / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL"
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
        <Box borderWidth="1px" borderColor="brand.200" borderRadius="md" p={3} mt={3}>
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
                  «{suggestion.sourcePhrase}» · confianza {Math.round(suggestion.confidence * 100)}%
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
        <Box mt={4}>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setShowSourceText((current) => !current)}
            aria-expanded={showSourceText}
          >
            {showSourceText ? 'Ocultar texto original' : 'Ver texto original'}
          </Button>
          <Collapse in={showSourceText} animateOpacity>
            <Stack spacing={2} mt={2} maxH="220px" overflowY="auto">
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
          </Collapse>
        </Box>
      )}

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
              <Field label="Tags" helper="Separados por coma. Máximo 10, 32 caracteres cada uno.">
                <Input
                  value={newInstruction.tags}
                  onChange={(event) =>
                    setNewInstruction({ ...newInstruction, tags: event.target.value })
                  }
                  placeholder="VIP, CAFE, PREAUTH"
                />
              </Field>
              <HStack spacing={3} align="start">
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
              </HStack>
              <HStack spacing={3} align="start">
                <Field label="Visibilidad">
                  <Select
                    value={newInstruction.visibility}
                    onChange={(event) =>
                      setNewInstruction({
                        ...newInstruction,
                        visibility: event.target.value as InstructionVisibility,
                      })
                    }
                  >
                    {VISIBILITY_OPTIONS.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {INSTRUCTION_VISIBILITY_LABELS[visibility]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Departamento">
                  <Textarea
                    rows={1}
                    value={newInstruction.assignedDepartment}
                    onChange={(event) =>
                      setNewInstruction({
                        ...newInstruction,
                        assignedDepartment: event.target.value,
                      })
                    }
                    placeholder="FRONT_DESK"
                  />
                </Field>
              </HStack>
              <HStack spacing={3} align="start">
                <Field label="Acción">
                  <Select
                    value={newInstruction.actionType}
                    onChange={(event) =>
                      setNewInstruction({
                        ...newInstruction,
                        actionType: event.target.value as '' | InstructionActionType,
                      })
                    }
                  >
                    <option value="">Solo información</option>
                    {ACTION_OPTIONS.map((action) => (
                      <option key={action} value={action}>
                        {INSTRUCTION_ACTION_LABELS[action]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Momento">
                  <Select
                    value={newInstruction.executionMoment}
                    onChange={(event) =>
                      setNewInstruction({
                        ...newInstruction,
                        executionMoment: event.target.value as '' | InstructionExecutionMoment,
                      })
                    }
                  >
                    <option value="">Sin momento</option>
                    {MOMENT_OPTIONS.map((moment) => (
                      <option key={moment} value={moment}>
                        {INSTRUCTION_MOMENT_LABELS[moment]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </HStack>
              <HStack spacing={3} align="start">
                <Field label="Válida desde">
                  <Input
                    type="datetime-local"
                    value={newInstruction.validFrom}
                    onChange={(event) =>
                      setNewInstruction({ ...newInstruction, validFrom: event.target.value })
                    }
                  />
                </Field>
                <Field label="Válida hasta">
                  <Input
                    type="datetime-local"
                    value={newInstruction.validUntil}
                    onChange={(event) =>
                      setNewInstruction({ ...newInstruction, validUntil: event.target.value })
                    }
                  />
                </Field>
              </HStack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              colorScheme="brand"
              isLoading={saving}
              isDisabled={
                newInstruction.title.trim().length < 2 || newInstruction.body.trim().length < 2
              }
            >
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleEdit(event)}>
          <ModalHeader>Editar instrucción</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Field label="Título" isRequired>
                <Textarea
                  rows={1}
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                />
              </Field>
              <Field label="Detalle" isRequired>
                <Textarea
                  rows={3}
                  value={editForm.body}
                  onChange={(event) => setEditForm({ ...editForm, body: event.target.value })}
                />
              </Field>
              <Field label="Tags" helper="Separados por coma. Máximo 10, 32 caracteres cada uno.">
                <Input
                  value={editForm.tags}
                  onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })}
                />
              </Field>
              <HStack spacing={3} align="start">
                <Field label="Prioridad">
                  <Select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
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
                <Field label="Visibilidad">
                  <Select
                    value={editForm.visibility}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        visibility: event.target.value as InstructionVisibility,
                      })
                    }
                  >
                    {VISIBILITY_OPTIONS.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {INSTRUCTION_VISIBILITY_LABELS[visibility]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </HStack>
              <Field label="Departamento">
                <Textarea
                  rows={1}
                  value={editForm.assignedDepartment}
                  onChange={(event) =>
                    setEditForm({ ...editForm, assignedDepartment: event.target.value })
                  }
                />
              </Field>
              <HStack spacing={3} align="start">
                <Field label="Válida desde">
                  <Input
                    type="datetime-local"
                    value={editForm.validFrom}
                    onChange={(event) =>
                      setEditForm({ ...editForm, validFrom: event.target.value })
                    }
                  />
                </Field>
                <Field label="Válida hasta">
                  <Input
                    type="datetime-local"
                    value={editForm.validUntil}
                    onChange={(event) =>
                      setEditForm({ ...editForm, validUntil: event.target.value })
                    }
                  />
                </Field>
              </HStack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              colorScheme="brand"
              isLoading={saving}
              isDisabled={editForm.title.trim().length < 2 || editForm.body.trim().length < 2}
            >
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SectionCard>
  );
}
