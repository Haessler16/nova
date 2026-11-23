'use client';

import {
  Badge,
  Button,
  Code,
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
import { QueryFeedback, SectionCard } from '@/components/ui';
import type { Role } from '@/lib/types';
import type { AdminData } from '../_hooks/use-admin-data';

export function AdminRolesPanel({
  data,
  onCreate,
  onEdit,
}: {
  data: AdminData;
  onCreate: () => void;
  onEdit: (role: Role) => void;
}) {
  const { roles } = data;

  return (
    <TabPanel px={0}>
      <SectionCard>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold">Roles de organización</Text>
          <Button size="sm" colorScheme="brand" onClick={onCreate}>
            Nuevo rol
          </Button>
        </HStack>
        <QueryFeedback
          loading={roles.loading}
          error={roles.error}
          onRetry={roles.reload}
          isEmpty={(roles.data?.items.length ?? 0) === 0}
          emptyText="No hay roles."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Rol</Th>
                  <Th>Key</Th>
                  <Th isNumeric>Permisos</Th>
                  <Th isNumeric>Miembros</Th>
                  <Th>Tipo</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {roles.data?.items.map((role) => (
                  <Tr key={role.id}>
                    <Td fontWeight="medium">{role.name}</Td>
                    <Td>
                      <Code fontSize="xs">{role.key}</Code>
                    </Td>
                    <Td isNumeric>{role.permissions.length}</Td>
                    <Td isNumeric>{role.membershipCount}</Td>
                    <Td>
                      <Badge colorScheme={role.system ? 'brand' : 'gray'} textTransform="none">
                        {role.system ? 'Sistema' : 'Personalizado'}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onEdit(role)}
                        isDisabled={role.system}
                        title={role.system ? 'Los roles de sistema son inmutables' : undefined}
                      >
                        Editar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
        <Text fontSize="xs" color="gray.500" mt={3}>
          Un rol solo puede otorgar permisos que el administrador ya posee.
        </Text>
      </SectionCard>
    </TabPanel>
  );
}
