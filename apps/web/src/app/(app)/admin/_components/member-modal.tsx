'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Code,
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
} from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import type { MemberEditor } from '../_hooks/use-member-editor';

export function MemberModal({
  editor,
  roles,
}: {
  editor: MemberEditor;
  roles: Role[] | undefined;
}) {
  const { t } = useI18n();
  const editing = editor.editing !== null;

  return (
    <Modal isOpen={editor.modal.isOpen} onClose={editor.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void editor.save(event)}>
        <ModalHeader>
          {editor.editing === null
            ? t('admin.memberModal.titleCreate')
            : t('admin.memberModal.titleEdit')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Field label={t('admin.memberModal.email')} isRequired>
              <Input
                type="email"
                value={editor.form.email}
                onChange={(event) => editor.setForm({ ...editor.form, email: event.target.value })}
                isDisabled={editing}
                required
              />
            </Field>
            <Field label={t('admin.memberModal.name')} helper={t('admin.memberModal.nameHelper')}>
              <Input
                value={editor.form.name}
                onChange={(event) => editor.setForm({ ...editor.form, name: event.target.value })}
                isDisabled={editing}
              />
            </Field>
            <Field label={t('admin.memberModal.role')}>
              <Select
                value={editor.form.roleId}
                onChange={(event) => editor.setForm({ ...editor.form, roleId: event.target.value })}
              >
                <option value="">{t('admin.memberModal.noRole')}</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
            {editing && (
              <Field label={t('admin.memberModal.status')}>
                <Select
                  value={editor.form.status}
                  onChange={(event) =>
                    editor.setForm({ ...editor.form, status: event.target.value })
                  }
                >
                  <option value="ACTIVE">{t('admin.memberModal.statusActive')}</option>
                  <option value="SUSPENDED">{t('admin.memberModal.statusSuspended')}</option>
                  <option value="DISABLED">{t('admin.memberModal.statusDisabled')}</option>
                </Select>
              </Field>
            )}
            {editor.invitationToken !== null && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="xs">
                  {t('admin.memberModal.invitation')}
                  <Code display="block" mt={1} wordBreak="break-all">
                    {editor.invitationToken}
                  </Code>
                </AlertDescription>
              </Alert>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={editor.modal.onClose}>
            {editor.invitationToken !== null
              ? t('admin.memberModal.close')
              : t('admin.memberModal.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={editor.saving}>
            {editor.editing === null ? t('admin.memberModal.create') : t('admin.memberModal.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
