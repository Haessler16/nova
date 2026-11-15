'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
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
  Text,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { DOCUMENT_TYPE_LABELS } from '@/lib/format';
import type {
  Guest,
  GuestDocumentType,
  MinorSupervision,
  ReservationParty as ReservationPartyResponse,
  ReservationPartyMember,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { QueryFeedback } from './ui';

const SUPERVISION_LABELS: Record<MinorSupervision, string> = {
  ACCOMPANIED: 'Acompañado por el responsable',
  UNACCOMPANIED_AUTHORIZED: 'Autorizado a viajar sin acompañante',
  UNACCOMPANIED_WITHOUT_AUTHORIZATION: 'Sin autorización registrada',
  UNKNOWN: 'Sin definir',
};

const READINESS_LABELS: Record<string, string> = {
  PRIMARY_MISSING: 'Falta el huésped principal o no coincide con la reserva.',
  GUEST_COUNT_MISMATCH: 'La fiesta no coincide con la ocupación declarada.',
  AGE_GROUP_UNKNOWN: 'Falta clasificar la edad de algún huésped.',
  PRIMARY_NOT_ADULT: 'El huésped principal debe ser adulto y capaz.',
  MINOR_RESPONSIBLE_MISSING: 'Un menor no tiene responsable válido.',
  MINOR_SUPERVISION_UNKNOWN: 'Falta indicar cómo viaja un menor.',
  MINOR_AUTHORIZATION_MISSING: 'Hay un menor sin autorización registrada.',
  MINOR_AUTHORIZATION_REFERENCE_MISSING: 'Falta la referencia de autorización de un menor.',
  LEGAL_INCAPACITY_RESPONSIBLE_MISSING: 'Falta el responsable de una persona incapaz.',
  DOCUMENT_NOT_FNRH_READY: 'Falta CPF o pasaporte para la FNRH.',
  PROFILE_INCOMPLETE: 'Faltan datos del perfil FNRH.',
};

interface EditorState {
  kind: 'adult' | 'minor';
  member: ReservationPartyMember | null;
}

interface EditorForm {
  guestId: string | null;
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
  responsibleReservationGuestId: string;
  minorSupervision: MinorSupervision;
  authorizationReference: string;
}

export function ReservationParty({
  reservationId,
  checkInDate,
  editable,
  onChanged,
}: {
  reservationId: string;
  checkInDate: string;
  editable: boolean;
  onChanged?: () => void;
}) {
  const { tenant } = useSession();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const party = useAsyncData<ReservationPartyResponse>(async () => {
    if (tenant.organizationId === null || tenant.propertyId === null) {
      throw new Error('Seleccioná una propiedad para ver la fiesta de la reserva.');
    }
    return api<ReservationPartyResponse>(`/api/v1/reservations/${reservationId}/party`, {
      tenant,
    });
  }, `${tenant.organizationId}:${tenant.propertyId}:${reservationId}:party:${version}`);

  function reload(): void {
    setVersion((current) => current + 1);
    onChanged?.();
  }

  async function removeMember(member: ReservationPartyMember): Promise<void> {
    if (member.reservationGuestId === null) return;
    if (!window.confirm(`¿Quitar a ${member.fullName} de esta reserva?`)) return;
    setRemovingId(member.reservationGuestId);
    try {
      await api<ReservationPartyResponse>(
        `/api/v1/reservations/${reservationId}/party/${member.reservationGuestId}`,
        { method: 'DELETE', tenant },
      );
      toast({ title: `${member.fullName} quitado de la reserva`, status: 'success' });
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo quitar al huésped',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setRemovingId(null);
    }
  }

  const data = party.data;
  const members = data === null ? [] : [data.primary, ...data.companions].filter(isMember);
  const legal = data?.readiness.checkIn === 'BLOCKED';
  const incomplete = data !== null && data.readiness.fnrh !== 'READY';

  return (
    <Box borderTopWidth="1px" borderColor="line" pt={4}>
      <HStack justify="space-between" align="flex-start" mb={3}>
        <Box>
          <Text fontWeight="semibold">Huéspedes de la reserva</Text>
          <Text fontSize="xs" color="gray.500">
            Los menores se vinculan a un responsable y no generan una FNRH propia.
          </Text>
        </Box>
        {data !== null && (
          <Badge
            colorScheme={
              data.readiness.checkIn === 'BLOCKED'
                ? 'danger'
                : data.readiness.fnrh === 'READY'
                  ? 'mint'
                  : 'warning'
            }
            textTransform="none"
          >
            {data.readiness.checkIn === 'BLOCKED'
              ? 'Bloqueo legal'
              : data.readiness.fnrh === 'READY'
                ? 'Fiesta completa'
                : 'Fiesta incompleta'}
          </Badge>
        )}
      </HStack>

      <QueryFeedback
        loading={party.loading}
        error={party.error}
        onRetry={party.reload}
        isEmpty={data === null}
        emptyText="No se pudo cargar la fiesta de la reserva."
      >
        {data !== null && (
          <Stack spacing={3}>
            <Text fontSize="sm">
              {data.summary.adults} {data.summary.adults === 1 ? 'adulto' : 'adultos'} ·{' '}
              {data.summary.minors} {data.summary.minors === 1 ? 'menor' : 'menores'}
              {data.summary.unknown > 0 ? ` · ${data.summary.unknown} sin clasificar` : ''}
              <Text as="span" color="gray.500">
                {' '}
                · declarado: {data.summary.declaredAdults} adultos · {data.summary.declaredChildren}{' '}
                menores
              </Text>
            </Text>

            {legal && (
              <Alert status="error" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  El check-in y la FNRH están bloqueados. Revisá los menores marcados antes de
                  continuar.
                </AlertDescription>
              </Alert>
            )}
            {!legal && incomplete && (
              <Alert status="warning" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  La fiesta está incompleta. El check-in hotelero puede continuar; la FNRH queda
                  pendiente hasta completar los datos.
                </AlertDescription>
              </Alert>
            )}
            {!legal && !incomplete && (
              <Alert status="success" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  Fiesta completa y datos FNRH listos.
                </AlertDescription>
              </Alert>
            )}

            {data.readiness.codes.length > 0 && (
              <Box>
                {data.readiness.codes.slice(0, 4).map((code) => (
                  <Text key={code} fontSize="xs" color="gray.600">
                    • {READINESS_LABELS[code] ?? code}
                  </Text>
                ))}
              </Box>
            )}

            <Stack spacing={2} divider={<Divider />}>
              {members.map((member) => (
                <PartyMemberRow
                  key={member.reservationGuestId ?? member.guestId}
                  member={member}
                  editable={editable && member.reservationGuestId !== null}
                  removing={removingId === member.reservationGuestId}
                  onEdit={() =>
                    setEditor({
                      kind:
                        member.ageGroup === 'MINOR' &&
                        (member.ageAtCheckIn === null || member.ageAtCheckIn < 18)
                          ? 'minor'
                          : 'adult',
                      member,
                    })
                  }
                  onRemove={() => void removeMember(member)}
                />
              ))}
            </Stack>

            {editable && (
              <HStack spacing={2} wrap="wrap" pt={1}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditor({ kind: 'adult', member: null })}
                >
                  + Agregar adulto
                </Button>
                <Button
                  size="sm"
                  colorScheme="brand"
                  onClick={() => setEditor({ kind: 'minor', member: null })}
                >
                  + Agregar menor
                </Button>
              </HStack>
            )}
          </Stack>
        )}
      </QueryFeedback>

      {editor !== null && data !== null && (
        <PartyEditorModal
          key={`${editor.kind}:${editor.member?.reservationGuestId ?? 'new'}`}
          editor={editor}
          party={data}
          reservationId={reservationId}
          checkInDate={checkInDate}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}
    </Box>
  );
}

function PartyMemberRow({
  member,
  editable,
  removing,
  onEdit,
  onRemove,
}: {
  member: ReservationPartyMember;
  editable: boolean;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const primary = member.role === 'PRIMARY';
  const minor = member.ageGroup === 'MINOR';
  const legal =
    minor &&
    (member.responsibleReservationGuestId === null ||
      member.minorSupervision === null ||
      member.minorSupervision === 'UNKNOWN' ||
      member.minorSupervision === 'UNACCOMPANIED_WITHOUT_AUTHORIZATION' ||
      (member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' && !member.authorizationReference));
  const description = member.documentType
    ? `${DOCUMENT_TYPE_LABELS[member.documentType]} ${maskDocument(member)}`
    : 'Sin documento';
  return (
    <Box
      borderWidth="1px"
      borderColor={primary ? 'brand.200' : legal ? 'danger.200' : 'line'}
      borderLeftWidth={minor ? '4px' : '1px'}
      borderLeftColor={minor ? (legal ? 'danger.400' : 'mint.400') : undefined}
      borderRadius="md"
      ml={minor ? 4 : 0}
      px={3}
      py={2}
      bg={primary ? 'brand.50' : 'surface'}
    >
      <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={2}>
        <Box minW={0}>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" fontWeight="semibold">
              {member.fullName}
            </Text>
            <Badge colorScheme={primary ? 'sky' : minor ? 'warning' : 'gray'} textTransform="none">
              {primary ? 'Principal' : minor ? 'Menor' : 'Acompañante'}
            </Badge>
            <Badge colorScheme={legal ? 'danger' : 'gray'} textTransform="none">
              {member.ageGroup === 'ADULT'
                ? 'Adulto'
                : member.ageGroup === 'MINOR'
                  ? 'Menor'
                  : 'Sin clasificar'}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.600">
            {description}
            {member.email ? ` · ${member.email}` : ''}
            {member.ageAtCheckIn !== null ? ` · ${member.ageAtCheckIn} años al check-in` : ''}
          </Text>
          {minor && (
            <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.600'}>
              Responsable: {member.responsibleName ?? 'sin responsable'} ·{' '}
              {member.minorSupervision
                ? SUPERVISION_LABELS[member.minorSupervision]
                : 'supervisión sin definir'}
              {member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED'
                ? ` · Ref. ${member.authorizationReference ?? 'faltante'}`
                : ''}
            </Text>
          )}
          <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.500'}>
            {minor
              ? 'FNRH: incluida en la ficha del responsable'
              : member.documentType === 'CPF' || member.documentType === 'PASSPORT'
                ? 'FNRH: documento válido'
                : 'FNRH: falta CPF o pasaporte'}
          </Text>
        </Box>
        {editable && (
          <HStack spacing={1}>
            <Button size="xs" variant="ghost" onClick={onEdit}>
              Editar
            </Button>
            {!primary && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="danger"
                onClick={onRemove}
                isLoading={removing}
              >
                Quitar
              </Button>
            )}
          </HStack>
        )}
      </HStack>
    </Box>
  );
}

function PartyEditorModal({
  editor,
  party,
  reservationId,
  checkInDate,
  onClose,
  onSaved,
}: {
  editor: EditorState;
  party: ReservationPartyResponse;
  reservationId: string;
  checkInDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tenant } = useSession();
  const toast = useToast();
  const editing = editor.member !== null;
  const [form, setForm] = useState<EditorForm>(() => formFromMember(editor, party));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(guestSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [guestSearch]);

  const guests = useAsyncData<{ items: Guest[] }>(async () => {
    if (editor.kind !== 'adult' || editing) return { items: [] };
    const params = new URLSearchParams({ status: 'ACTIVE', limit: '6' });
    if (debouncedSearch !== '') params.set('search', debouncedSearch);
    return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
  }, `${tenant.organizationId}:${tenant.propertyId}:party-guest-search:${debouncedSearch}:${editing}:${editor.kind}`);

  const responsibleOptions = useMemo(
    () =>
      [party.primary, ...party.companions].filter(
        (member): member is ReservationPartyMember =>
          member !== null &&
          member.ageGroup !== 'MINOR' &&
          member.reservationGuestId !== null &&
          member.reservationGuestId !== editor.member?.reservationGuestId,
      ),
    [party, editor.member?.reservationGuestId],
  );

  function patch(next: Partial<EditorForm>): void {
    setForm((current) => ({ ...current, ...next }));
  }

  function selectExistingGuest(guest: Guest): void {
    patch({
      guestId: guest.id,
      fullName: guest.fullName,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      documentType: guest.documentType ?? '',
      documentNumber: guest.documentNumber ?? '',
    });
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFormError('');
    const fullName = form.fullName.trim();
    const age = ageAtCheckIn(form.birthDate, checkInDate);

    if (fullName.length < 2) {
      setFormError('Ingresá nombre y apellido.');
      return;
    }
    if (!form.birthDate) {
      setFormError('La fecha de nacimiento es obligatoria para clasificar la edad.');
      return;
    }
    if (editor.kind === 'adult' && age < 18) {
      setFormError('Al check-in será menor de edad. Usá el alta de menor.');
      return;
    }
    if (editor.kind === 'minor' && age >= 18) {
      setFormError('Al check-in tendrá 18 años. Registralo como adulto.');
      return;
    }
    if (editor.kind === 'minor' && form.responsibleReservationGuestId === '') {
      setFormError('Elegí un responsable adulto de esta reserva.');
      return;
    }
    if (
      editor.kind === 'minor' &&
      form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' &&
      form.authorizationReference.trim() === ''
    ) {
      setFormError('Ingresá la referencia de la autorización.');
      return;
    }
    if (form.documentType === 'CPF' && form.documentNumber.replace(/\D/g, '').length !== 11) {
      setFormError('El CPF debe tener 11 dígitos.');
      return;
    }

    const payload: Record<string, unknown> = {
      birthDate: form.birthDate,
      ...(editor.kind === 'minor'
        ? {
            minorSupervision: form.minorSupervision,
            responsibleReservationGuestId: form.responsibleReservationGuestId,
            authorizationReference: form.authorizationReference.trim(),
          }
        : {}),
    };
    if (!editing) {
      if (form.guestId !== null) {
        payload.guestId = form.guestId;
      } else {
        payload.fullName = fullName;
        payload.email = form.email.trim();
        payload.phone = form.phone.trim();
        if (form.documentType !== '') {
          payload.documentType = form.documentType;
          payload.documentNumber = form.documentNumber.trim();
        }
      }
    } else {
      payload.fullName = fullName;
      payload.email = form.email.trim();
      payload.phone = form.phone.trim();
      if (form.documentType === '') {
        payload.documentType = null;
        payload.documentNumber = null;
      } else {
        payload.documentType = form.documentType;
        payload.documentNumber = form.documentNumber.trim();
      }
    }

    setSaving(true);
    try {
      const path = editing
        ? `/api/v1/reservations/${reservationId}/party/${editor.member?.reservationGuestId}`
        : `/api/v1/reservations/${reservationId}/party`;
      await api<ReservationPartyResponse>(path, {
        method: editing ? 'PATCH' : 'POST',
        tenant,
        body: payload,
      });
      toast({
        title: editing ? 'Huésped actualizado' : 'Huésped agregado a la reserva',
        status: 'success',
      });
      onSaved();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void submit(event)}>
        <ModalHeader>
          {editing
            ? editor.kind === 'minor'
              ? 'Editar menor'
              : 'Editar huésped'
            : editor.kind === 'minor'
              ? 'Agregar menor'
              : 'Agregar acompañante adulto'}
          <Text fontSize="sm" fontWeight="normal" color="gray.500">
            {editor.kind === 'minor'
              ? 'El menor se vincula a un responsable y no genera una FNRH propia.'
              : 'Se agrega a la fiesta de esta reserva; no cambia el huésped principal.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {editor.kind === 'adult' && !editing && (
              <Box>
                <FormLabel fontSize="sm" fontWeight="semibold">
                  Vincular huésped existente (opcional)
                </FormLabel>
                <Input
                  size="sm"
                  placeholder="Buscar por nombre, email o documento…"
                  value={guestSearch}
                  onChange={(event) => setGuestSearch(event.target.value)}
                />
                {form.guestId !== null && (
                  <HStack
                    mt={2}
                    justify="space-between"
                    bg="brand.50"
                    borderRadius="md"
                    px={2}
                    py={1}
                  >
                    <Text fontSize="xs">Huésped vinculado: {form.fullName}</Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        patch({
                          guestId: null,
                          fullName: '',
                          email: '',
                          phone: '',
                          documentType: '',
                          documentNumber: '',
                        })
                      }
                    >
                      Quitar vínculo
                    </Button>
                  </HStack>
                )}
                {(guests.data?.items.length ?? 0) > 0 && form.guestId === null && (
                  <Stack mt={2} spacing={1} maxH="160px" overflowY="auto">
                    {guests.data?.items.map((guest) => {
                      const already =
                        party.primary?.guestId === guest.id ||
                        party.companions.some((member) => member.guestId === guest.id);
                      return (
                        <Button
                          key={guest.id}
                          size="sm"
                          variant="ghost"
                          justifyContent="space-between"
                          isDisabled={already}
                          onClick={() => selectExistingGuest(guest)}
                        >
                          <Text fontSize="xs">{guest.fullName}</Text>
                          <Text fontSize="xs" color="gray.500">
                            {already
                              ? 'Ya está en la fiesta'
                              : (guest.documentNumber ?? 'sin documento')}
                          </Text>
                        </Button>
                      );
                    })}
                  </Stack>
                )}
                <FormHelperText>
                  Si no encontrás a la persona, completá los datos para crear una ficha nueva.
                </FormHelperText>
              </Box>
            )}

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Nombre completo</FormLabel>
                <Input
                  value={form.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Fecha de nacimiento</FormLabel>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => patch({ birthDate: event.target.value })}
                />
                <FormHelperText>La edad se calcula a la fecha de check-in.</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Email</FormLabel>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => patch({ email: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Teléfono</FormLabel>
                <Input
                  value={form.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Tipo de documento</FormLabel>
                <Select
                  value={form.documentType}
                  onChange={(event) =>
                    patch({ documentType: event.target.value as '' | GuestDocumentType })
                  }
                >
                  <option value="">Sin documento</option>
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as GuestDocumentType[]).map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Número de documento</FormLabel>
                <Input
                  value={form.documentNumber}
                  onChange={(event) => patch({ documentNumber: event.target.value })}
                />
              </FormControl>
            </SimpleGrid>

            {editor.kind === 'minor' && (
              <>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Responsable</FormLabel>
                  <Select
                    value={form.responsibleReservationGuestId}
                    onChange={(event) =>
                      patch({ responsibleReservationGuestId: event.target.value })
                    }
                  >
                    <option value="">Seleccionar…</option>
                    {responsibleOptions.map((member) => (
                      <option
                        key={member.reservationGuestId}
                        value={member.reservationGuestId ?? ''}
                      >
                        {member.fullName}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Supervisión</FormLabel>
                  <Select
                    value={form.minorSupervision}
                    onChange={(event) =>
                      patch({ minorSupervision: event.target.value as MinorSupervision })
                    }
                  >
                    {Object.entries(SUPERVISION_LABELS)
                      .filter(([value]) => value !== 'UNKNOWN')
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </Select>
                </FormControl>
                {form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' && (
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Referencia de autorización</FormLabel>
                    <Input
                      value={form.authorizationReference}
                      onChange={(event) => patch({ authorizationReference: event.target.value })}
                      placeholder="Identificador interno; no adjuntes el documento"
                    />
                  </FormControl>
                )}
              </>
            )}

            {formError !== '' && <FormErrorMessage fontSize="sm">{formError}</FormErrorMessage>}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={saving}>
            {editing ? 'Guardar cambios' : 'Agregar a la reserva'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function formFromMember(editor: EditorState, party: ReservationPartyResponse): EditorForm {
  const member = editor.member;
  return {
    guestId: member?.guestId ?? null,
    fullName: member?.fullName ?? '',
    birthDate: member?.birthDate ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    documentType: member?.documentType ?? '',
    documentNumber: member?.documentNumber ?? '',
    responsibleReservationGuestId:
      member?.responsibleReservationGuestId ?? party.primary?.reservationGuestId ?? '',
    minorSupervision: member?.minorSupervision ?? 'ACCOMPANIED',
    authorizationReference: member?.authorizationReference ?? '',
  };
}

function isMember(member: ReservationPartyMember | null): member is ReservationPartyMember {
  return member !== null;
}

function maskDocument(member: ReservationPartyMember): string {
  if (!member.documentNumber) return '';
  if (member.documentType === 'CPF') {
    const digits = member.documentNumber.replace(/\D/g, '');
    return `•••.${digits.slice(-6, -2)}-${digits.slice(-2)}`;
  }
  if (member.documentType === 'PASSPORT') return `••••${member.documentNumber.slice(-4)}`;
  return member.documentNumber;
}

function ageAtCheckIn(birthDate: string, checkInDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const checkIn = new Date(`${checkInDate}T00:00:00Z`);
  let age = checkIn.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    checkIn.getUTCMonth() < birth.getUTCMonth() ||
    (checkIn.getUTCMonth() === birth.getUTCMonth() && checkIn.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}
