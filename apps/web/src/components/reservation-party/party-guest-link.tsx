'use client';

import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { Guest, ReservationParty as ReservationPartyResponse } from '@/lib/types';
import type { EditorForm } from './lib/party-utils';

export function PartyGuestLink({
  form,
  party,
  guestSearch,
  onGuestSearchChange,
  guests,
  onSelectGuest,
  onUnlink,
}: {
  form: EditorForm;
  party: ReservationPartyResponse;
  guestSearch: string;
  onGuestSearchChange: (value: string) => void;
  guests: Guest[];
  onSelectGuest: (guest: Guest) => void;
  onUnlink: () => void;
}) {
  const { t } = useI18n();

  return (
    <FormControl>
      <FormLabel fontSize="sm" fontWeight="semibold">
        {t('party.link.label')}
      </FormLabel>
      <Input
        data-testid="party-guest-search"
        size="sm"
        placeholder={t('party.link.searchPlaceholder')}
        value={guestSearch}
        onChange={(event) => onGuestSearchChange(event.target.value)}
      />
      {form.guestId !== null && (
        <HStack mt={2} justify="space-between" bg="brand.50" borderRadius="md" px={2} py={1}>
          <Text fontSize="xs">{t('party.link.linked', { name: form.fullName })}</Text>
          <Button size="xs" variant="ghost" onClick={onUnlink}>
            {t('party.link.unlink')}
          </Button>
        </HStack>
      )}
      {guests.length > 0 && form.guestId === null && (
        <Stack mt={2} spacing={1} maxH="160px" overflowY="auto">
          {guests.map((guest) => {
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
                onClick={() => onSelectGuest(guest)}
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
  );
}
