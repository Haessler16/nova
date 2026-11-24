'use client';

import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
} from '@chakra-ui/react';
import { DOCUMENT_TYPES, documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { GuestDocumentType } from '@/lib/types';
import type { EditorForm } from './lib/party-utils';

export function PartyEditorFields({
  form,
  patch,
  editing,
}: {
  form: EditorForm;
  patch: (next: Partial<EditorForm>) => void;
  editing: boolean;
}) {
  const { t, locale } = useI18n();

  return (
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
  );
}
