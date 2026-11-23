'use client';

import { Box, Button, Divider, HStack, Stack, Text } from '@chakra-ui/react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import type { GuestFormState } from '../_lib/reservation-forms';
import { GuestFields } from './guest-fields';

export function GuestPickerHeader({
  showNew,
  onCreate,
}: {
  showNew: boolean;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  return (
    <HStack justify="space-between" mb={2}>
      <Text fontWeight="semibold">{t('reservations.section.guest')}</Text>
      {showNew && (
        <Button size="xs" variant="ghost" colorScheme="brand" onClick={onCreate}>
          {t('reservations.guest.new')}
        </Button>
      )}
    </HStack>
  );
}

export function GuestCreatePanel({
  form,
  setForm,
  errors,
  saving,
  onCancel,
  onCreate,
}: {
  form: GuestFormState;
  setForm: (update: (current: GuestFormState) => GuestFormState) => void;
  errors: FieldErrors;
  saving: boolean;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  return (
    <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
      <GuestFields
        value={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        disabled={saving}
        idPrefix="new-reservation-guest"
        errors={errors}
      />
      <HStack justify="flex-end" mt={3}>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" colorScheme="brand" onClick={onCreate} isLoading={saving}>
          {t('reservations.guest.createAndSelect')}
        </Button>
      </HStack>
    </Box>
  );
}

export function GuestResults({
  guests,
  loading,
  term,
  error,
  onSelect,
}: {
  guests: Guest[];
  loading: boolean;
  term: string;
  error: unknown;
  onSelect: (guest: Guest) => void;
}) {
  const { t } = useI18n();
  return (
    <Stack spacing={2}>
      <Box borderWidth="1px" borderColor="line" borderRadius="md" maxH="150px" overflowY="auto">
        {loading ? (
          <Text px={3} py={2} fontSize="sm" color="textSecondary">
            {t('reservations.guest.searching')}
          </Text>
        ) : guests.length === 0 ? (
          <Text px={3} py={2} fontSize="sm" color="textSecondary">
            {term === ''
              ? t('reservations.guest.noneActive')
              : t('reservations.guest.noneActiveFor', { term })}
          </Text>
        ) : (
          <Stack spacing={0} divider={<Divider />}>
            {guests.map((guest) => (
              <Button
                key={guest.id}
                variant="ghost"
                justifyContent="flex-start"
                h="auto"
                py={2}
                px={3}
                borderRadius="none"
                onClick={() => onSelect(guest)}
              >
                <Box textAlign="left" minW={0}>
                  <Text fontSize="sm" fontWeight="medium" isTruncated>
                    {guest.fullName}
                  </Text>
                  <Text fontSize="xs" color="textSecondary" isTruncated>
                    {[guest.email, guest.phone].filter(Boolean).join(' · ') ||
                      t('reservations.guest.noContact')}
                  </Text>
                </Box>
              </Button>
            ))}
          </Stack>
        )}
      </Box>
      {error !== null && (
        <Text fontSize="xs" color="danger.500">
          {errorMessage(error)}
        </Text>
      )}
    </Stack>
  );
}
