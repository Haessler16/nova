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
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();
  const { roles } = data;

  return (
    <TabPanel px={0}>
      <SectionCard>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold">{t('admin.roles.title')}</Text>
          <Button size="sm" colorScheme="brand" onClick={onCreate}>
            {t('admin.roles.create')}
          </Button>
        </HStack>
        <QueryFeedback
          loading={roles.loading}
          error={roles.error}
          onRetry={roles.reload}
          isEmpty={(roles.data?.items.length ?? 0) === 0}
          emptyText={t('admin.roles.empty')}
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>{t('admin.roles.role')}</Th>
                  <Th>{t('admin.roles.key')}</Th>
                  <Th isNumeric>{t('admin.roles.permissions')}</Th>
                  <Th isNumeric>{t('admin.roles.members')}</Th>
                  <Th>{t('admin.roles.type')}</Th>
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
                        {role.system ? t('admin.roles.system') : t('admin.roles.custom')}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onEdit(role)}
                        isDisabled={role.system}
                        title={role.system ? t('admin.roles.systemLocked') : undefined}
                      >
                        {t('admin.roles.edit')}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
        <Text fontSize="xs" color="gray.500" mt={3}>
          {t('admin.roles.note')}
        </Text>
      </SectionCard>
    </TabPanel>
  );
}
