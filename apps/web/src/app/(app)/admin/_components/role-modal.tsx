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
import type { AdminData } from '../_hooks/use-admin-data';
import type { RoleEditor } from '../_hooks/use-role-editor';
import { RolePermissionPicker } from './role-permission-picker';

export function RoleModal({ editor, data }: { editor: RoleEditor; data: AdminData }) {
  return (
    <Modal isOpen={editor.modal.isOpen} onClose={editor.modal.onClose} size="xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void editor.save(event)}>
        <ModalHeader>
          {editor.editing === null ? 'Nuevo rol' : `Editar rol ${editor.editing.key}`}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <SimpleGrid columns={2} spacing={4}>
              <Field label="Key" isRequired helper="Mayúsculas, números, puntos o guiones.">
                <Input
                  value={editor.form.key}
                  onChange={(event) =>
                    editor.setForm({ ...editor.form, key: event.target.value })
                  }
                  isDisabled={editor.editing !== null}
                  required
                />
              </Field>
              <Field label="Nombre" isRequired>
                <Input
                  value={editor.form.name}
                  onChange={(event) =>
                    editor.setForm({ ...editor.form, name: event.target.value })
                  }
                  required
                />
              </Field>
            </SimpleGrid>
            <Divider />
            <Text fontSize="sm" fontWeight="medium">
              Permisos ({editor.form.permissions.length})
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
            Cancelar
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={editor.saving}>
            Guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
