'use client';

import {
  Button,
  Divider,
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
  Textarea,
} from '@chakra-ui/react';
import { Field } from '@/components/ui';
import {
  INCIDENT_SEVERITY_COLORS,
  incidentSeverityLabel,
  incidentTypeLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, IncidentSeverity, IncidentType, Stay } from '@/lib/types';
import type { IncidentCreateController } from '../_hooks/use-incidents';
import { INCIDENT_TYPES, type IncidentForm } from '../_lib/front-office.types';
import { IncidentScopeFields } from './incident-scope-fields';

function IncidentMetaFields({
  form,
  update,
}: {
  form: IncidentForm;
  update: <K extends keyof IncidentForm>(key: K, value: IncidentForm[K]) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      <Field label={t('frontOffice.incidentForm.type')}>
        <Select
          value={form.type}
          onChange={(event) => update('type', event.target.value as IncidentType)}
        >
          {INCIDENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {incidentTypeLabel(locale, value)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('frontOffice.incidentForm.severity')}>
        <Select
          value={form.severity}
          onChange={(event) => update('severity', event.target.value as IncidentSeverity)}
        >
          {(Object.keys(INCIDENT_SEVERITY_COLORS) as IncidentSeverity[]).map((value) => (
            <option key={value} value={value}>
              {incidentSeverityLabel(locale, value)}
            </option>
          ))}
        </Select>
      </Field>
    </SimpleGrid>
  );
}

export function IncidentDialog({
  create,
  data,
  inHouse,
  busy,
}: {
  create: IncidentCreateController;
  data: FrontOfficeOverview | null;
  inHouse: Stay[];
  busy: string | null;
}) {
  const { t } = useI18n();

  return (
    <Modal isOpen={create.modal.isOpen} onClose={create.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void create.submit(event)}>
        <ModalHeader>{t('frontOffice.incidentForm.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3}>
            {create.target !== null && (
              <Text fontSize="sm">
                {t('frontOffice.incidentForm.stay', {
                  name: create.target.guest.fullName,
                  number: create.target.room.number,
                })}
              </Text>
            )}
            <IncidentMetaFields form={create.form} update={create.update} />
            <Field
              label={t('frontOffice.incidentForm.titleField')}
              isRequired
              helper={t('frontOffice.incidentForm.titleHelper')}
            >
              <Input
                value={create.form.title}
                maxLength={120}
                onChange={(event) => create.update('title', event.target.value)}
                required
              />
            </Field>
            <Field
              label={t('frontOffice.incidentForm.description')}
              isRequired
              helper={t('frontOffice.incidentForm.descriptionHelper')}
            >
              <Textarea
                rows={4}
                value={create.form.description}
                maxLength={4000}
                onChange={(event) => create.update('description', event.target.value)}
                required
              />
            </Field>
            {create.target === null && (
              <IncidentScopeFields
                form={create.form}
                update={create.update}
                data={data}
                inHouse={inHouse}
              />
            )}
            <Divider />
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.incidentForm.footnote')}
            </Text>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={create.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={busy === 'incident:create'}>
            {t('frontOffice.incidentForm.register')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
