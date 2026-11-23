'use client';

import {
  Badge,
  Button,
  HStack,
  Table,
  TableContainer,
  TabPanel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import {
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  formatDateTime,
} from '@/lib/format';
import type { Membership } from '@/lib/types';
import type { AdminData } from '../_hooks/use-admin-data';

export function AdminMembersPanel({
  data,
  onCreate,
  onEdit,
  onProperties,
  onSessions,
}: {
  data: AdminData;
  onCreate: () => void;
  onEdit: (member: Membership) => void;
  onProperties: (member: Membership) => void;
  onSessions: (member: Membership) => void;
}) {
  const { memberships } = data;

  return (
    <TabPanel px={0}>
      <SectionCard>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold">Membresías de la organización</Text>
          <HStack>
            <Button size="sm" variant="ghost" onClick={memberships.reload}>
              Actualizar
            </Button>
            <Button size="sm" colorScheme="brand" onClick={onCreate}>
              Nuevo miembro
            </Button>
          </HStack>
        </HStack>
        <QueryFeedback
          loading={memberships.loading}
          error={memberships.error}
          onRetry={memberships.reload}
          isEmpty={(memberships.data?.items.length ?? 0) === 0}
          emptyText="La organización no tiene membresías."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Usuario</Th>
                  <Th>Rol de organización</Th>
                  <Th>Propiedades</Th>
                  <Th>Estado</Th>
                  <Th>Alta</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {memberships.data?.items.map((member) => (
                  <Tr key={member.id}>
                    <Td>
                      <Text fontWeight="medium">{member.user.name}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {member.user.email}
                      </Text>
                    </Td>
                    <Td>{member.role?.name ?? 'Sin rol'}</Td>
                    <Td>
                      <HStack spacing={1} wrap="wrap">
                        {member.propertyMemberships.length === 0 && (
                          <Text fontSize="xs" color="gray.500">
                            Sin asignaciones
                          </Text>
                        )}
                        {member.propertyMemberships.map((assignment) => (
                          <Badge key={assignment.id} colorScheme="gray" textTransform="none">
                            {assignment.property.code} · {assignment.role.name}
                          </Badge>
                        ))}
                      </HStack>
                    </Td>
                    <Td>
                      <StatusBadge
                        color={RECORD_STATUS_COLORS[member.status] ?? 'gray'}
                        label={RECORD_STATUS_LABELS[member.status] ?? member.status}
                      />
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="gray.500">
                        {formatDateTime(member.createdAt)}
                      </Text>
                    </Td>
                    <Td>
                      <HStack spacing={1} justify="flex-end">
                        <Button size="xs" variant="ghost" onClick={() => onEdit(member)}>
                          Editar
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onProperties(member)}>
                          Propiedades
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onSessions(member)}>
                          Sesiones
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>
    </TabPanel>
  );
}
