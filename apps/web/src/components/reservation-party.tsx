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
import { DOCUMENT_TYPES, documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import type {
  Guest,
  GuestDocumentType,
  MinorSupervision,
  ReservationParty as ReservationPartyResponse,
  ReservationPartyMember,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { QueryFeedback } from './ui';

const SUPERVISION_LABEL_KEYS: Record<MinorSupervision, TranslationKey> = {
  ACCOMPANIED: 'party.supervision.accompanied',
  UNACCOMPANIED_AUTHORIZED: 'party.supervision.authorized',
  UNACCOMPANIED_WITHOUT_AUTHORIZATION: 'party.supervision.withoutAuthorization',
  UNKNOWN: 'party.supervision.unknown',
};

type Translator = ReturnType<typeof useI18n>['t'];

function supervisionLabel(t: Translator, value: MinorSupervision): string {
  return t(SUPERVISION_LABEL_KEYS[value]);
}

const READINESS_LABEL_KEYS: Record<string, TranslationKey> = {
  PRIMARY_MISSING: 'party.readiness.primaryMissing',
  GUEST_COUNT_MISMATCH: 'party.readiness.guestCountMismatch',
  AGE_GROUP_UNKNOWN: 'party.readiness.ageGroupUnknown',
  PRIMARY_NOT_ADULT: 'party.readiness.primaryNotAdult',
  MINOR_RESPONSIBLE_MISSING: 'party.readiness.minorResponsibleMissing',
  MINOR_SUPERVISION_UNKNOWN: 'party.readiness.minorSupervisionUnknown',
  MINOR_AUTHORIZATION_MISSING: 'party.readiness.minorAuthorizationMissing',
  MINOR_AUTHORIZATION_REFERENCE_MISSING: 'party.readiness.minorAuthorizationReferenceMissing',
  LEGAL_INCAPACITY_RESPONSIBLE_MISSING: 'party.readiness.legalIncapacityResponsibleMissing',
  DOCUMENT_NOT_FNRH_READY: 'party.readiness.documentNotFnrhReady',
  PROFILE_INCOMPLETE: 'party.readiness.profileIncomplete',
};

function readinessLabel(t: Translator, code: string): string {
  const key = READINESS_LABEL_KEYS[code];
  return key === undefined ? code : t(key);
}

function adultsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('party.summary.adultsOne', { count })
    : t('party.summary.adultsOther', { count });
}

function minorsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('party.summary.minorsOne', { count })
    : t('party.summary.minorsOther', { count });
}

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
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const party = useAsyncData<ReservationPartyResponse>(async () => {
    if (tenant.organizationId === null || tenant.propertyId === null) {
      throw new Error(t('party.empty'));
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
    if (!window.confirm(t('party.confirm.remove', { name: member.fullName }))) return;
    setRemovingId(member.reservationGuestId);
    try {
      await api<ReservationPartyResponse>(
        `/api/v1/reservations/${reservationId}/party/${member.reservationGuestId}`,
        { method: 'DELETE', tenant },
      );
      toast({ title: t('party.toast.removed', { name: member.fullName }), status: 'success' });
      reload();
    } catch (cause) {
      toast({
        title: t('party.toast.removeError'),
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
    <Box borderTopWidth="1px" borderColor="line" pt={4} data-testid="reservation-party">
      <HStack justify="space-between" align="flex-start" mb={3}>
        <Box>
          <Text fontWeight="semibold">{t('party.title')}</Text>
          <Text fontSize="xs" color="gray.500">
            {t('party.subtitle')}
          </Text>
        </Box>
        {data !== null && (
          <Badge
            data-testid="party-readiness"
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
              ? t('party.badge.legal')
              : data.readiness.fnrh === 'READY'
                ? t('party.badge.complete')
                : t('party.badge.incomplete')}
          </Badge>
        )}
      </HStack>

      <QueryFeedback
        loading={party.loading}
        error={party.error}
        onRetry={party.reload}
        isEmpty={data === null}
        emptyText={t('party.empty')}
      >
        {data !== null && (
          <Stack spacing={3}>
            <Text fontSize="sm">
              {adultsLabel(t, data.summary.adults)} · {minorsLabel(t, data.summary.minors)}
              {data.summary.unknown > 0
                ? ` · ${t('party.summary.unknown', { count: data.summary.unknown })}`
                : ''}
              <Text as="span" color="gray.500">
                {' '}
                {t('party.summary.declared', {
                  adults: adultsLabel(t, data.summary.declaredAdults),
                  children: minorsLabel(t, data.summary.declaredChildren),
                })}
              </Text>
            </Text>

            {legal && (
              <Alert status="error" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">{t('party.alert.legal')}</AlertDescription>
              </Alert>
            )}
            {!legal && incomplete && (
              <Alert status="warning" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">{t('party.alert.incomplete')}</AlertDescription>
              </Alert>
            )}
            {!legal && !incomplete && (
              <Alert status="success" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">{t('party.alert.ready')}</AlertDescription>
              </Alert>
            )}

            {data.readiness.codes.length > 0 && (
              <Box>
                {data.readiness.codes.slice(0, 4).map((code) => (
                  <Text key={code} fontSize="xs" color="gray.600">
                    • {readinessLabel(t, code)}
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
                  data-testid="add-adult"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditor({ kind: 'adult', member: null })}
                >
                  {t('party.addAdult')}
                </Button>
                <Button
                  data-testid="add-minor"
                  size="sm"
                  colorScheme="brand"
                  onClick={() => setEditor({ kind: 'minor', member: null })}
                >
                  {t('party.addMinor')}
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
  const { t, locale } = useI18n();
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
    ? `${documentTypeLabel(locale, member.documentType)} ${maskDocument(member)}`
    : t('reservations.guest.noDocument');
  return (
    <Box
      data-testid="party-member"
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
              {primary
                ? t('party.role.primary')
                : minor
                  ? t('party.role.minor')
                  : t('party.role.companion')}
            </Badge>
            <Badge colorScheme={legal ? 'danger' : 'gray'} textTransform="none">
              {member.ageGroup === 'ADULT'
                ? t('party.age.adult')
                : member.ageGroup === 'MINOR'
                  ? t('party.role.minor')
                  : t('party.age.unclassified')}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.600">
            {description}
            {member.email ? ` · ${member.email}` : ''}
            {member.ageAtCheckIn !== null
              ? ` ${t('party.age.atCheckIn', { age: member.ageAtCheckIn })}`
              : ''}
          </Text>
          {minor && (
            <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.600'}>
              {t('party.member.responsible', {
                name: member.responsibleName ?? t('party.member.noResponsible'),
              })}{' '}
              ·{' '}
              {member.minorSupervision
                ? supervisionLabel(t, member.minorSupervision)
                : t('party.member.noSupervision')}
              {member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED'
                ? ` ${t('party.member.authorizationRef', {
                    reference: member.authorizationReference ?? t('party.member.referenceMissing'),
                  })}`
                : ''}
            </Text>
          )}
          <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.500'}>
            {minor
              ? t('party.member.fnrhIncluded')
              : member.documentType === 'CPF' || member.documentType === 'PASSPORT'
                ? t('party.member.fnrhValid')
                : t('party.member.fnrhMissing')}
          </Text>
        </Box>
        {editable && (
          <HStack spacing={1}>
            <Button size="xs" variant="ghost" onClick={onEdit}>
              {t('reservations.row.edit')}
            </Button>
            {!primary && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="danger"
                onClick={onRemove}
                isLoading={removing}
              >
                {t('party.member.remove')}
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
  const { t, locale } = useI18n();
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
      setFormError(t('party.error.fullName'));
      return;
    }
    if (!form.birthDate) {
      setFormError(t('party.error.birthDate'));
      return;
    }
    if (editor.kind === 'adult' && age < 18) {
      setFormError(t('party.error.adultIsMinor'));
      return;
    }
    if (editor.kind === 'minor' && age >= 18) {
      setFormError(t('party.error.minorIsAdult'));
      return;
    }
    if (editor.kind === 'minor' && form.responsibleReservationGuestId === '') {
      setFormError(t('party.error.responsible'));
      return;
    }
    if (
      editor.kind === 'minor' &&
      form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' &&
      form.authorizationReference.trim() === ''
    ) {
      setFormError(t('party.error.authorization'));
      return;
    }
    if (form.documentType === 'CPF' && form.documentNumber.replace(/\D/g, '').length !== 11) {
      setFormError(t('party.error.cpf'));
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
        title: editing ? t('party.toast.updated') : t('party.toast.added'),
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
      <ModalContent as="form" data-testid="party-editor" onSubmit={(event) => void submit(event)}>
        <ModalHeader>
          {editing
            ? editor.kind === 'minor'
              ? t('party.modal.editMinor')
              : t('party.modal.editGuest')
            : editor.kind === 'minor'
              ? t('party.modal.addMinor')
              : t('party.modal.addAdult')}
          <Text fontSize="sm" fontWeight="normal" color="gray.500">
            {editor.kind === 'minor' ? t('party.subtitle') : t('party.modal.addedToParty')}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {editor.kind === 'adult' && !editing && (
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="semibold">
                  {t('party.link.label')}
                </FormLabel>
                <Input
                  data-testid="party-guest-search"
                  size="sm"
                  placeholder={t('party.link.searchPlaceholder')}
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
                    <Text fontSize="xs">{t('party.link.linked', { name: form.fullName })}</Text>
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
                      {t('party.link.unlink')}
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
                              ? t('party.link.alreadyInParty')
                              : (guest.documentNumber ?? t('reservations.guest.noDocument'))}
                          </Text>
                        </Button>
                      );
                    })}
                  </Stack>
                )}
                <FormHelperText>{t('party.link.helper')}</FormHelperText>
              </FormControl>
            )}

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('reservations.guest.field.fullName')}</FormLabel>
                <Input
                  data-testid="party-full-name"
                  value={form.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('party.field.birthDate')}</FormLabel>
                <Input
                  data-testid="party-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => patch({ birthDate: event.target.value })}
                />
                <FormHelperText>{t('party.field.birthDateHelper')}</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('reservations.guest.field.email')}</FormLabel>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => patch({ email: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('reservations.guest.field.phone')}</FormLabel>
                <Input
                  value={form.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                  isReadOnly={form.guestId !== null && !editing}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('reservations.guest.field.documentType')}</FormLabel>
                <Select
                  data-testid="party-document-type"
                  value={form.documentType}
                  onChange={(event) =>
                    patch({ documentType: event.target.value as '' | GuestDocumentType })
                  }
                >
                  <option value="">{t('reservations.guest.noDocument')}</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {documentTypeLabel(locale, type)}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('reservations.guest.field.documentNumber')}</FormLabel>
                <Input
                  data-testid="party-document-number"
                  value={form.documentNumber}
                  onChange={(event) => patch({ documentNumber: event.target.value })}
                />
              </FormControl>
            </SimpleGrid>

            {editor.kind === 'minor' && (
              <>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t('party.field.responsible')}</FormLabel>
                  <Select
                    data-testid="party-responsible"
                    value={form.responsibleReservationGuestId}
                    onChange={(event) =>
                      patch({ responsibleReservationGuestId: event.target.value })
                    }
                  >
                    <option value="">{t('reservations.room.selectPlaceholder')}</option>
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
                  <FormLabel fontSize="sm">{t('party.field.supervision')}</FormLabel>
                  <Select
                    data-testid="party-supervision"
                    value={form.minorSupervision}
                    onChange={(event) =>
                      patch({ minorSupervision: event.target.value as MinorSupervision })
                    }
                  >
                    {(Object.keys(SUPERVISION_LABEL_KEYS) as MinorSupervision[])
                      .filter((value) => value !== 'UNKNOWN')
                      .map((value) => (
                        <option key={value} value={value}>
                          {supervisionLabel(t, value)}
                        </option>
                      ))}
                  </Select>
                </FormControl>
                {form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' && (
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">{t('party.field.authorizationReference')}</FormLabel>
                    <Input
                      data-testid="party-authorization-reference"
                      value={form.authorizationReference}
                      onChange={(event) => patch({ authorizationReference: event.target.value })}
                      placeholder={t('party.field.authorizationPlaceholder')}
                    />
                  </FormControl>
                )}
              </>
            )}

            {formError !== '' && (
              <Text role="alert" color="danger.500" fontSize="sm">
                {formError}
              </Text>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={saving} data-testid="party-submit">
            {editing ? t('party.submit.save') : t('party.submit.add')}
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
