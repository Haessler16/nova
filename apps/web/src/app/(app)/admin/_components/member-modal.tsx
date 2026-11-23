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
import type { Role } from '@/lib/types';
import type { MemberEditor } from '../_hooks/use-member-editor';

export function MemberModal({
  editor,
  roles,
}: {
  editor: MemberEditor;
  roles: Role[] | undefined;
}) {
  const editing = editor.editing !== null;

  return (
    <Modal isOpen={editor.modal.isOpen} onClose={editor.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void editor.save(event)}>
        <ModalHeader>{editor.editing === null ? 'Nuevo miembro' : 'Editar membresía'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Field label="Email" isRequired>
              <Input
                type="email"
                value={editor.form.email}
                onChange={(event) =>
                  editor.setForm({ ...editor.form, email: event.target.value })
                }
                isDisabled={editing}
                required
              />
            </Field>
            <Field label="Nombre" helper="Si el usuario no existe, se crea con una invitación.">
              <Input
                value={editor.form.name}
                onChange={(event) => editor.setForm({ ...editor.form, name: event.target.value })}
                isDisabled={editing}
              />
            </Field>
            <Field label="Rol de organización">
              <Select
                value={editor.form.roleId}
                onChange={(event) =>
                  editor.setForm({ ...editor.form, roleId: event.target.value })
                }
              >
                <option value="">Sin rol de organización</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
            {editing && (
              <Field label="Estado">
                <Select
                  value={editor.form.status}
                  onChange={(event) =>
                    editor.setForm({ ...editor.form, status: event.target.value })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="DISABLED">Deshabilitado</option>
                </Select>
              </Field>
            )}
            {editor.invitationToken !== null && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="xs">
                  Invitación generada. Token de un solo uso:
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
            {editor.invitationToken !== null ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={editor.saving}>
            {editor.editing === null ? 'Crear membresía' : 'Guardar'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
