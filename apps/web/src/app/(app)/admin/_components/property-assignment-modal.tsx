'use client';

import {
  Box,
  Button,
  Divider,
  HStack,
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
} from '@chakra-ui/react';
import { Field, StatusBadge } from '@/components/ui';
import { RECORD_STATUS_COLORS, RECORD_STATUS_LABELS } from '@/lib/format';
import type { Role } from '@/lib/types';
import type { PropertyAssignment } from '../_hooks/use-property-assignment';

export function PropertyAssignmentModal({
  assignment,
  roles,
  properties,
}: {
  assignment: PropertyAssignment;
  roles: Role[] | undefined;
  properties: Array<{ id: string; name: string; code: string }>;
}) {
  return (
    <Modal isOpen={assignment.modal.isOpen} onClose={assignment.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Asignaciones de propiedad · {assignment.member?.user.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3} mb={5}>
            {assignment.member?.propertyMemberships.map((membership) => (
              <HStack
                key={membership.id}
                justify="space-between"
                borderWidth="1px"
                borderRadius="md"
                px={3}
                py={2}
              >
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {membership.property.name}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {membership.role.name}
                  </Text>
                </Box>
                <StatusBadge
                  color={RECORD_STATUS_COLORS[membership.status] ?? 'gray'}
                  label={RECORD_STATUS_LABELS[membership.status] ?? membership.status}
                />
              </HStack>
            ))}
            {(assignment.member?.propertyMemberships.length ?? 0) === 0 && (
              <Text fontSize="sm" color="gray.500">
                Sin asignaciones de propiedad.
              </Text>
            )}
          </Stack>
          <Divider mb={4} />
          <Box as="form" onSubmit={(event) => void assignment.add(event)}>
            <SimpleGrid columns={2} spacing={3}>
              <Field label="Propiedad" isRequired>
                <Select
                  value={assignment.form.propertyId}
                  onChange={(event) =>
                    assignment.setForm({ ...assignment.form, propertyId: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} · {property.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rol" isRequired>
                <Select
                  value={assignment.form.roleId}
                  onChange={(event) =>
                    assignment.setForm({ ...assignment.form, roleId: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {roles?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </SimpleGrid>
            <Text fontSize="xs" color="gray.500" mt={2}>
              El backend valida que el rol sea subconjunto de tus permisos y que el usuario sea
              miembro de la organización.
            </Text>
            <Button type="submit" size="sm" colorScheme="brand" mt={3} isLoading={assignment.saving}>
              Agregar asignación
            </Button>
          </Box>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={assignment.modal.onClose}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
