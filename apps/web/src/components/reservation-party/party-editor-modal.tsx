'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import type {
  ReservationParty as ReservationPartyResponse,
  ReservationPartyMember,
} from '@/lib/types';
import type { EditorState } from './lib/party-utils';
import { usePartyEditorForm } from './lib/use-party-editor-form';
import { usePartyGuestSearch } from './lib/use-party-guest-search';
import { PartyEditorFields } from './party-editor-fields';
import { PartyEditorMinorFields } from './party-editor-minor-fields';
import { PartyGuestLink } from './party-guest-link';

export function PartyEditorModal({
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
  const { t } = useI18n();
  const { form, patch, selectExistingGuest, formError, saving, submit, editing } =
    usePartyEditorForm({ editor, party, reservationId, checkInDate, onSaved });
  const { guestSearch, setGuestSearch, guests } = usePartyGuestSearch(editor.kind, editing);

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
              <PartyGuestLink
                form={form}
                party={party}
                guestSearch={guestSearch}
                onGuestSearchChange={setGuestSearch}
                guests={guests.data?.items ?? []}
                onSelectGuest={selectExistingGuest}
                onUnlink={() =>
                  patch({
                    guestId: null,
                    fullName: '',
                    email: '',
                    phone: '',
                    documentType: '',
                    documentNumber: '',
                  })
                }
              />
            )}

            <PartyEditorFields form={form} patch={patch} editing={editing} />

            {editor.kind === 'minor' && (
              <PartyEditorMinorFields
                form={form}
                patch={patch}
                responsibleOptions={responsibleOptions}
              />
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
