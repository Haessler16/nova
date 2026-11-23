'use client';

import { Box, Button, HStack, Input, Stack, Text, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { hasErrors, validateGuest, type FieldErrors } from '@/lib/validation';
import type { Tenant } from '../_hooks/use-reservation-list';
import { EMPTY_GUEST_FORM, guestCreateBody, type GuestFormState } from '../_lib/reservation-forms';
import { guestFieldLabels, validationCopy } from '../_lib/reservation-labels';
import { GuestCreatePanel, GuestPickerHeader, GuestResults } from './guest-picker-parts';

function SelectedGuestCard({
  guest,
  onEdit,
  onChange,
}: {
  guest: Guest;
  onEdit: () => void;
  onChange: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3} bg="gray.50">
      <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={3}>
        <Box minW={0}>
          <Text fontWeight="semibold">{guest.fullName}</Text>
          <Text fontSize="xs" color="textSecondary" isTruncated>
            {[guest.email, guest.phone].filter(Boolean).join(' · ') ||
              t('reservations.guest.noContact')}
          </Text>
          <Text fontSize="xs" color="textSecondary">
            {guest.documentType !== null
              ? `${documentTypeLabel(locale, guest.documentType)} ${guest.documentNumber ?? ''}`
              : t('reservations.guest.noDocument')}
          </Text>
        </Box>
        <HStack spacing={2}>
          <Button size="xs" variant="outline" onClick={onEdit}>
            {t('reservations.guest.editData')}
          </Button>
          <Button size="xs" variant="ghost" onClick={onChange}>
            {t('reservations.guest.change')}
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}

function GuestSearchPanel({
  search,
  onSearchChange,
  guests,
  loading,
  term,
  error,
  onSelect,
  onCreateNew,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  guests: Guest[];
  loading: boolean;
  term: string;
  error: unknown;
  onSelect: (guest: Guest) => void;
  onCreateNew: () => void;
}) {
  const { t } = useI18n();
  return (
    <Stack spacing={2}>
      <Input
        aria-label={t('reservations.guest.searchAria')}
        placeholder={t('reservations.guest.searchPlaceholder')}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <GuestResults
        guests={guests}
        loading={loading}
        term={term}
        error={error}
        onSelect={onSelect}
      />
      <Button size="xs" variant="link" alignSelf="flex-start" onClick={onCreateNew}>
        {search.trim() === ''
          ? t('reservations.guest.createNew')
          : t('reservations.guest.createNewFor', { term: search.trim() })}
      </Button>
    </Stack>
  );
}

export function GuestPicker({
  tenant,
  enabled,
  selectedGuest,
  guestError,
  onSelect,
  onClear,
  onEdit,
}: {
  tenant: Tenant;
  enabled: boolean;
  selectedGuest: Guest | null;
  guestError?: string;
  onSelect: (guest: Guest) => void;
  onClear: () => void;
  onEdit: (guest: Guest) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [panel, setPanel] = useState<'none' | 'create'>('none');
  const [form, setForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const lookup = useAsyncData<{ items: Guest[] }>(
    async () => {
      if (!enabled) {
        return { items: [] };
      }
      const params = new URLSearchParams({ status: 'ACTIVE', limit: '8' });
      if (debounced !== '') params.set('search', debounced);
      return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:guest-search:${String(enabled)}:${debounced}`,
  );

  function startCreate(): void {
    setForm({ ...EMPTY_GUEST_FORM, fullName: search.trim() });
    setPanel('create');
  }

  async function createGuest(): Promise<void> {
    const nextErrors = validateGuest(form, {
      copy: validationCopy(t),
      labels: guestFieldLabels(t),
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const guest = await api<Guest>('/api/v1/guests', {
        method: 'POST',
        tenant,
        body: guestCreateBody(form),
      });
      onSelect(guest);
      setForm(EMPTY_GUEST_FORM);
      setPanel('none');
      setSearch('');
      toast({ title: t('reservations.toast.guestCreated'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('reservations.toast.guestCreateError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <GuestPickerHeader
        showNew={selectedGuest === null && panel === 'none'}
        onCreate={startCreate}
      />

      {guestError !== undefined && (
        <Text fontSize="xs" color="danger.500" mb={2}>
          {guestError}
        </Text>
      )}

      {selectedGuest !== null ? (
        <SelectedGuestCard
          guest={selectedGuest}
          onEdit={() => onEdit(selectedGuest)}
          onChange={() => {
            onClear();
            setSearch('');
          }}
        />
      ) : panel === 'create' ? (
        <GuestCreatePanel
          form={form}
          setForm={setForm}
          errors={errors}
          saving={saving}
          onCancel={() => setPanel('none')}
          onCreate={() => void createGuest()}
        />
      ) : (
        <GuestSearchPanel
          search={search}
          onSearchChange={setSearch}
          guests={lookup.data?.items ?? []}
          loading={lookup.loading}
          term={debounced}
          error={lookup.error}
          onSelect={onSelect}
          onCreateNew={startCreate}
        />
      )}
    </Box>
  );
}
