'use client';

import {
  Box,
  Button,
  Checkbox,
  HStack,
  Link,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { PilotFeedback, PilotFeedbackCategory, PilotFeedbackStatus } from '@/lib/pilot-types';
import { useAsyncData } from '@/lib/use-async-data';

const CHECKLIST_STORAGE_KEY = 'nova.pilot.checklist.v1';

const ONBOARDING_STEPS = [
  {
    id: 'property',
    title: 'Revisar la propiedad',
    description: 'Timezone, moneda y hora de corte del día operativo.',
    href: '/settings',
  },
  {
    id: 'rooms',
    title: 'Configurar habitaciones',
    description: 'Tipos de habitación y habitaciones activas.',
    href: '/inventory/rooms',
  },
  {
    id: 'guest',
    title: 'Registrar un huésped',
    description: 'Solo datos mínimos y sintéticos.',
    href: '/guests',
  },
  {
    id: 'reservation',
    title: 'Crear una reserva',
    description: 'Fechas, ocupación y disponibilidad.',
    href: '/reservations',
  },
  {
    id: 'front-office',
    title: 'Probar check-in y check-out',
    description: 'Llegadas del día, room rack e incidencias.',
    href: '/front-office',
  },
  {
    id: 'folio',
    title: 'Abrir folio y cobrar',
    description: 'Cargo, pago parcial y saldo pendiente.',
    href: '/folios',
  },
  {
    id: 'cash',
    title: 'Abrir y cerrar caja',
    description: 'Movimientos, esperado y diferencia con motivo.',
    href: '/cashier',
  },
  {
    id: 'night-audit',
    title: 'Cerrar el día operativo',
    description: 'Bloqueos, cierre forzado con motivo y reopen controlado.',
    href: '/cashier',
  },
] as const;

const CATEGORY_LABELS: Record<PilotFeedbackCategory, string> = {
  BUG: 'Error',
  UX: 'Experiencia de uso',
  QUESTION: 'Pregunta',
  OTHER: 'Otro',
};

const STATUS_LABELS: Record<PilotFeedbackStatus, { color: string; label: string }> = {
  OPEN: { color: 'warning', label: 'Pendiente' },
  REVIEWED: { color: 'mint', label: 'Revisado' },
  ARCHIVED: { color: 'gray', label: 'Archivado' },
};

function PilotContent() {
  const { tenant } = useSession();
  const toast = useToast();

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [category, setCategory] = useState<PilotFeedbackCategory>('UX');
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const feedback = useAsyncData<{ items: PilotFeedback[] }>(
    () => api<{ items: PilotFeedback[] }>('/api/v1/pilot/feedback', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:pilot-feedback`,
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw !== null) {
        setDone(JSON.parse(raw) as Record<string, boolean>);
      }
    } catch {
      // Corrupt local state must never block onboarding.
    }
  }, []);

  const completed = ONBOARDING_STEPS.filter((step) => done[step.id] === true).length;
  const progress = Math.round((completed / ONBOARDING_STEPS.length) * 100);

  function toggleStep(id: string): void {
    setDone((current) => {
      const next = { ...current, [id]: current[id] !== true };
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (message.trim().length < 8) {
      toast({ title: 'Escribí al menos 8 caracteres', status: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await api<PilotFeedback>('/api/v1/pilot/feedback', {
        method: 'POST',
        tenant,
        body: {
          category,
          message: message.trim(),
          ...(rating !== '' ? { rating: Number(rating) } : {}),
          context: { route: '/pilot', appVersion: 'phase-6' },
        },
      });
      setMessage('');
      setRating('');
      toast({ title: 'Feedback enviado', status: 'success' });
      feedback.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo enviar el feedback',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(id: string): Promise<void> {
    try {
      await api<PilotFeedback>(`/api/v1/pilot/feedback/${id}/review`, {
        method: 'PATCH',
        tenant,
      });
      feedback.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo marcar como revisado',
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  const items = feedback.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Piloto"
        title="Onboarding y feedback"
        description="Checklist operativo para las primeras sesiones con el hotel piloto y un canal único para registrar errores, dudas y fricción de uso. Los mensajes quedan asociados a la propiedad y no modifican datos operativos."
      />

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} mb={5}>
        <SectionCard>
          <HStack justify="space-between" mb={1}>
            <Text fontWeight="semibold">Checklist de onboarding</Text>
            <Text fontSize="sm" color="textSecondary">
              {completed}/{ONBOARDING_STEPS.length}
            </Text>
          </HStack>
          <Progress
            value={progress}
            size="sm"
            colorScheme="brand"
            borderRadius="full"
            mb={4}
            aria-label={`Progreso del onboarding: ${progress}%`}
          />
          <Stack spacing={3}>
            {ONBOARDING_STEPS.map((step) => (
              <HStack key={step.id} spacing={3} align="flex-start">
                <Checkbox
                  isChecked={done[step.id] === true}
                  onChange={() => toggleStep(step.id)}
                  mt={0.5}
                />
                <Box flex="1">
                  <Link
                    as={NextLink}
                    href={step.href}
                    fontWeight="semibold"
                    fontSize="sm"
                    color="brand.700"
                  >
                    {step.title}
                  </Link>
                  <Text fontSize="xs" color="textSecondary">
                    {step.description}
                  </Text>
                </Box>
              </HStack>
            ))}
          </Stack>
          <Button
            mt={4}
            size="sm"
            variant="ghost"
            onClick={() => {
              window.localStorage.removeItem(CHECKLIST_STORAGE_KEY);
              setDone({});
            }}
          >
            Reiniciar checklist
          </Button>
        </SectionCard>

        <SectionCard>
          <Text fontWeight="semibold" mb={1}>
            Enviar feedback
          </Text>
          <Text fontSize="sm" color="textSecondary" mb={4}>
            No incluyas datos personales, documentos ni información de tarjetas.
          </Text>
          <Box as="form" onSubmit={handleSubmit}>
            <Stack spacing={4}>
              <Field label="Categoría" isRequired>
                <Select
                  size="sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PilotFeedbackCategory)}
                >
                  {(Object.keys(CATEGORY_LABELS) as PilotFeedbackCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valoración" helper="Opcional, de 1 a 5.">
                <Select
                  size="sm"
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                >
                  <option value="">Sin valorar</option>
                  <option value="1">1 · Muy mala</option>
                  <option value="2">2 · Mala</option>
                  <option value="3">3 · Aceptable</option>
                  <option value="4">4 · Buena</option>
                  <option value="5">5 · Muy buena</option>
                </Select>
              </Field>
              <Field
                label="Mensaje"
                isRequired
                helper="Mínimo 8 caracteres. Se guarda con tu usuario y la propiedad activa."
              >
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={4000}
                />
              </Field>
              <Button
                type="submit"
                colorScheme="brand"
                alignSelf="flex-start"
                isLoading={submitting}
              >
                Enviar feedback
              </Button>
            </Stack>
          </Box>
        </SectionCard>
      </SimpleGrid>

      <SectionCard>
        <Text fontWeight="semibold" mb={1}>
          Feedback reciente
        </Text>
        <Text fontSize="sm" color="textSecondary" mb={4}>
          Solo los roles con permiso de lectura ven todo el feedback de la propiedad.
        </Text>
        <QueryFeedback
          loading={feedback.loading}
          error={feedback.error}
          onRetry={feedback.reload}
          isEmpty={items.length === 0}
          emptyText="Todavía no hay feedback registrado en esta propiedad."
        >
          <Stack spacing={3}>
            {items.map((item) => (
              <Box key={item.id} borderWidth="1px" borderColor="line" borderRadius="lg" p={4}>
                <HStack justify="space-between" align="flex-start" spacing={3}>
                  <Box flex="1" minW={0}>
                    <HStack spacing={2} mb={1} wrap="wrap">
                      <Text fontWeight="semibold" fontSize="sm">
                        {CATEGORY_LABELS[item.category]}
                      </Text>
                      <StatusBadge
                        color={STATUS_LABELS[item.status].color}
                        label={STATUS_LABELS[item.status].label}
                      />
                      {item.rating !== null && (
                        <Text fontSize="xs" color="textSecondary">
                          Valoración {item.rating}/5
                        </Text>
                      )}
                    </HStack>
                    <Text fontSize="sm">{item.message}</Text>
                    <Text fontSize="xs" color="textSecondary" mt={1}>
                      {formatDateTime(item.createdAt)}
                    </Text>
                  </Box>
                  {item.status === 'OPEN' && (
                    <Button size="xs" variant="outline" onClick={() => void handleReview(item.id)}>
                      Marcar revisado
                    </Button>
                  )}
                </HStack>
              </Box>
            ))}
          </Stack>
        </QueryFeedback>
      </SectionCard>
    </>
  );
}

export default function PilotPage() {
  return (
    <PropertyGate>
      <PilotContent />
    </PropertyGate>
  );
}
