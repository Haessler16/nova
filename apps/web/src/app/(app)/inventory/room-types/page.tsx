'use client';

import {
  Button,
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
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { ActionDialog } from '@/components/action-dialog';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { RowActionButton } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { RECORD_STATUS_COLORS, recordStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomType } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  hasErrors,
  validateRoomType,
  type FieldErrors,
  type RoomTypeFieldLabels,
  type ValidationCopy,
} from '@/lib/validation';

interface RoomTypeForm {
  name: string;
  code: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  bedType: string;
  status: 'ACTIVE' | 'DISABLED';
}

const EMPTY_FORM: RoomTypeForm = {
  name: '',
  code: '',
  description: '',
  capacityAdults: '2',
  capacityChildren: '0',
  bedType: '',
  status: 'ACTIVE',
};

function RoomTypesContent() {
  const { tenant } = useSession();
  const { t, locale } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const statusChangeModal = useDisclosure();
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomTypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [enableError, setEnableError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData<{ items: RoomType[] }>(
    () =>
      api<{ items: RoomType[] }>(
        `/api/v1/inventory/room-types${statusFilter !== '' ? `?status=${statusFilter}` : ''}`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:room-types:${statusFilter}`,
  );

  function openCreate(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    modal.onOpen();
  }

  function openEdit(roomType: RoomType): void {
    setEditingId(roomType.id);
    setForm({
      name: roomType.name,
      code: roomType.code,
      description: roomType.description ?? '',
      capacityAdults: String(roomType.capacityAdults),
      capacityChildren: String(roomType.capacityChildren),
      bedType: roomType.bedType ?? '',
      status: roomType.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    setErrors({});
    modal.onOpen();
  }

  async function handleDisableCore(): Promise<void> {
    if (editingId === null) {
      return;
    }
    setSaving(true);
    setEnableError(null);
    try {
      await api<RoomType>(`/api/v1/inventory/room-types/${editingId}`, {
        method: 'PATCH',
        tenant,
        body: { status: 'DISABLED' },
      });
      toast({ title: t('roomTypes.toast.disabled'), status: 'success' });
      statusChangeModal.onClose();
      setForm((current) => ({ ...current, status: 'DISABLED' }));
      reload();
    } catch (cause) {
      const message = errorMessage(cause);
      setEnableError(message);
      toast({
        title: t('roomTypes.toast.disableError'),
        description: message,
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  function openDisable(roomType: RoomType): void {
    setEditingId(roomType.id);
    setForm({
      name: roomType.name,
      code: roomType.code,
      description: roomType.description ?? '',
      capacityAdults: String(roomType.capacityAdults),
      capacityChildren: String(roomType.capacityChildren),
      bedType: roomType.bedType ?? '',
      status: 'ACTIVE',
    });
    setErrors({});
    setEnableError(null);
    statusChangeModal.onOpen();
  }

  /** Dictionary-backed messages/labels for the shared room-type validator. */
  function validationCopy(): ValidationCopy {
    return {
      required: (label) => t('validation.required', { label }),
      maxLength: (label, max) => t('validation.maxLength', { label, max }),
      integer: (label) => t('validation.integer', { label }),
      range: (label, min, max) => t('validation.range', { label, min, max }),
    };
  }

  function validationLabels(): RoomTypeFieldLabels {
    return {
      name: t('validation.roomType.name'),
      codeRequired: t('validation.roomType.codeRequired'),
      codeInvalid: t('validation.roomType.codeInvalid'),
      description: t('validation.roomType.description'),
      capacityAdults: t('validation.roomType.capacityAdults'),
      capacityChildren: t('validation.roomType.capacityChildren'),
      bedType: t('validation.roomType.bedType'),
    };
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateRoomType(
      { ...form, codeLocked: editingId !== null },
      { copy: validationCopy(), labels: validationLabels() },
    );
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const base = {
        name: form.name.trim(),
        description: form.description.trim() === '' ? undefined : form.description.trim(),
        capacityAdults: Number(form.capacityAdults),
        capacityChildren: Number(form.capacityChildren),
        bedType: form.bedType.trim() === '' ? undefined : form.bedType.trim(),
      };

      if (editingId === null) {
        await api<RoomType>('/api/v1/inventory/room-types', {
          method: 'POST',
          tenant,
          body: { ...base, code: form.code.trim() },
        });
        toast({ title: t('roomTypes.toast.created'), status: 'success' });
      } else {
        await api<RoomType>(`/api/v1/inventory/room-types/${editingId}`, {
          method: 'PATCH',
          tenant,
          body: { ...base, status: form.status },
        });
        toast({ title: t('roomTypes.toast.updated'), status: 'success' });
      }
      modal.onClose();
      reload();
    } catch (cause) {
      toast({
        title: t('roomTypes.toast.saveError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('roomTypes.title')}
        description={t('roomTypes.description')}
        actions={
          <Button colorScheme="brand" size="sm" onClick={openCreate}>
            {t('roomTypes.new')}
          </Button>
        }
      />

      <SectionCard>
        <HStack mb={4} justify="space-between" wrap="wrap" spacing={3}>
          <HStack>
            <Text fontSize="sm" color="textSecondary">
              {t('roomTypes.filterLabel')}
            </Text>
            <Select
              size="sm"
              width="150px"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">{t('roomTypes.filter.all')}</option>
              <option value="ACTIVE">{t('roomTypes.filter.active')}</option>
              <option value="DISABLED">{t('roomTypes.filter.disabled')}</option>
            </Select>
          </HStack>
          <Text fontSize="xs" color="textSecondary">
            {(data?.items.length ?? 0) === 1
              ? t('roomTypes.countOne')
              : t('roomTypes.countOther', { count: data?.items.length ?? 0 })}
          </Text>
        </HStack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText={t('roomTypes.empty')}
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>{t('roomTypes.column.name')}</Th>
                  <Th>{t('roomTypes.column.code')}</Th>
                  <Th isNumeric>{t('roomTypes.column.adults')}</Th>
                  <Th isNumeric>{t('roomTypes.column.children')}</Th>
                  <Th>{t('roomTypes.column.bed')}</Th>
                  <Th isNumeric>{t('roomTypes.column.rooms')}</Th>
                  <Th>{t('roomTypes.column.status')}</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.items.map((roomType) => (
                  <Tr key={roomType.id}>
                    <Td>
                      <Text fontWeight="medium">{roomType.name}</Text>
                      {roomType.description !== null && (
                        <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="320px">
                          {roomType.description}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text as="code" fontSize="xs">
                        {roomType.code}
                      </Text>
                    </Td>
                    <Td isNumeric>{roomType.capacityAdults}</Td>
                    <Td isNumeric>{roomType.capacityChildren}</Td>
                    <Td>{roomType.bedType ?? '—'}</Td>
                    <Td isNumeric>{roomType.roomCount}</Td>
                    <Td>
                      <StatusBadge
                        color={RECORD_STATUS_COLORS[roomType.status] ?? 'gray'}
                        label={recordStatusLabel(locale, roomType.status)}
                      />
                    </Td>
                    <Td>
                      <RowActionButton onClick={() => openEdit(roomType)}>
                        {t('roomTypes.edit')}
                      </RowActionButton>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleSubmit(event)}>
          <ModalHeader>
            {editingId === null ? t('roomTypes.createTitle') : t('roomTypes.editTitle')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label={t('roomTypes.field.name')} isRequired error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  maxLength={120}
                />
              </Field>
              <Field
                label={t('roomTypes.field.code')}
                isRequired
                error={errors.code}
                helper={t('roomTypes.field.codeHelper')}
              >
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  isDisabled={editingId !== null}
                  required
                  maxLength={24}
                />
              </Field>
              <Field label={t('roomTypes.field.description')} error={errors.description}>
                <Input
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  maxLength={500}
                />
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field
                  label={t('roomTypes.field.capacityAdults')}
                  isRequired
                  error={errors.capacityAdults}
                >
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.capacityAdults}
                    onChange={(event) => setForm({ ...form, capacityAdults: event.target.value })}
                    required
                  />
                </Field>
                <Field
                  label={t('roomTypes.field.capacityChildren')}
                  isRequired
                  error={errors.capacityChildren}
                >
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.capacityChildren}
                    onChange={(event) => setForm({ ...form, capacityChildren: event.target.value })}
                    required
                  />
                </Field>
              </HStack>
              <Field label={t('roomTypes.field.bedType')} error={errors.bedType}>
                <Input
                  value={form.bedType}
                  onChange={(event) => setForm({ ...form, bedType: event.target.value })}
                  maxLength={64}
                />
              </Field>
              {editingId !== null && (
                <Field label={t('roomTypes.field.status')}>
                  <Select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as 'ACTIVE' | 'DISABLED' })
                    }
                  >
                    <option value="ACTIVE">{t('roomTypes.status.active')}</option>
                    <option value="DISABLED">{t('roomTypes.status.disabled')}</option>
                  </Select>
                </Field>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={modal.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              {t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ActionDialog
        isOpen={statusChangeModal.isOpen}
        onClose={() => {
          statusChangeModal.onClose();
          setEnableError(null);
        }}
        tone="critical"
        title={t('roomTypes.disable.title')}
        summary={
          editingId === null
            ? t('roomTypes.disable.empty')
            : t('roomTypes.disable.summary', { name: form.name, code: form.code })
        }
        confirmLabel={t('roomTypes.disable.confirm')}
        hasUnsavedChanges={false}
        isLoading={saving}
        error={enableError ?? undefined}
        onConfirm={() => void handleDisableCore()}
      >
        <Text fontSize="sm" color="textSecondary">
          {t('roomTypes.disable.body')}
        </Text>
      </ActionDialog>
    </>
  );
}

export default function RoomTypesPage() {
  return (
    <PropertyGate>
      <RoomTypesContent />
    </PropertyGate>
  );
}
