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
} from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { InstructionCreate } from './use-instruction-create';
import { InstructionCoreFields } from './instruction-core-fields';
import { NewInstructionFields } from './new-instruction-fields';

export function InstructionCreateModal({ create }: { create: InstructionCreate }) {
  const { t } = useI18n();

  return (
    <Modal isOpen={create.modal.isOpen} onClose={create.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void create.submit(event)}>
        <ModalHeader>{t('instructions.create.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3}>
            <InstructionCoreFields
              form={create.form}
              onChange={create.setForm}
              tagsPlaceholder="VIP, CAFE, PREAUTH"
            />
            <NewInstructionFields form={create.form} onChange={create.setForm} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={create.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            colorScheme="brand"
            isLoading={create.saving}
            isDisabled={create.form.title.trim().length < 2 || create.form.body.trim().length < 2}
          >
            {t('instructions.create.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
