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
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Field, QueryFeedback } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { AdminData } from '../_hooks/use-admin-data';
import type { RoleEditor } from '../_hooks/use-role-editor';
import { RolePermissionPicker } from './role-permission-picker';

export function RoleModal({ editor, data }: { editor: RoleEditor; data: AdminData }) {
  const { t } = useI18n();

  return (
    <Modal isOpen={editor.modal.isOpen} onClose={editor.modal.onClose} size="xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void editor.save(event)}>
        <ModalHeader>
          {editor.editing === null
            ? t('admin.roleModal.titleCreate')
            : t('admin.roleModal.titleEdit', { key: editor.editing.key })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <SimpleGrid columns={2} spacing={4}>
              <Field
                label={t('admin.roleModal.key')}
                isRequired
                helper={t('admin.roleModal.keyHelper')}
              >
                <Input
                  value={editor.form.key}
                  onChange={(event) => editor.setForm({ ...editor.form, key: event.target.value })}
                  isDisabled={editor.editing !== null}
                  required
                />
              </Field>
              <Field label={t('admin.roleModal.name')} isRequired>
                <Input
                  value={editor.form.name}
                  onChange={(event) => editor.setForm({ ...editor.form, name: event.target.value })}
                  required
                />
              </Field>
            </SimpleGrid>
            <Divider />
            <Text fontSize="sm" fontWeight="medium">
              {t('admin.roleModal.permissions', { count: editor.form.permissions.length })}
            </Text>
            <QueryFeedback
              loading={data.permissions.loading}
              error={data.permissions.error}
              onRetry={data.permissions.reload}
            >
              <RolePermissionPicker
                groups={data.permissionGroups}
                selected={editor.form.permissions}
                onChange={(permissions) => editor.setForm({ ...editor.form, permissions })}
              />
            </QueryFeedback>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={editor.modal.onClose}>
            {t('admin.roleModal.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={editor.saving}>
            {t('admin.roleModal.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
