'use client';

import {
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Textarea,
} from '@chakra-ui/react';
import { instructionPriorityLabel, instructionVisibilityLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type {
  InstructionPriority,
  InstructionVisibility,
} from '@/lib/types';
import { Field } from '../ui';
import { InstructionCoreFields } from './instruction-core-fields';
import { InstructionValidityFields } from './instruction-validity-fields';
import { PRIORITY_OPTIONS, VISIBILITY_OPTIONS } from './instruction-options';
import type { InstructionEdit } from './use-instruction-edit';

export function InstructionEditModal({ edit }: { edit: InstructionEdit }) {
  const { t, locale } = useI18n();

  return (
    <Modal isOpen={edit.modal.isOpen} onClose={edit.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void edit.submit(event)}>
        <ModalHeader>{t('instructions.edit.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3}>
            <InstructionCoreFields form={edit.form} onChange={edit.setForm} />
            <HStack spacing={3} align="start">
              <Field label={t('instructions.form.priority')}>
                <Select
                  value={edit.form.priority}
                  onChange={(event) =>
                    edit.setForm({
                      ...edit.form,
                      priority: event.target.value as InstructionPriority,
                    })
                  }
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {instructionPriorityLabel(locale, priority)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('instructions.form.visibility')}>
                <Select
                  value={edit.form.visibility}
                  onChange={(event) =>
                    edit.setForm({
                      ...edit.form,
                      visibility: event.target.value as InstructionVisibility,
                    })
                  }
                >
                  {VISIBILITY_OPTIONS.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {instructionVisibilityLabel(locale, visibility)}
                    </option>
                  ))}
                </Select>
              </Field>
            </HStack>
            <Field label="Departamento">
              <Textarea
                rows={1}
                value={edit.form.assignedDepartment}
                onChange={(event) =>
                  edit.setForm({ ...edit.form, assignedDepartment: event.target.value })
                }
              />
            </Field>
            <InstructionValidityFields form={edit.form} onChange={edit.setForm} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={edit.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            colorScheme="brand"
            isLoading={edit.saving}
            isDisabled={edit.form.title.trim().length < 2 || edit.form.body.trim().length < 2}
          >
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
