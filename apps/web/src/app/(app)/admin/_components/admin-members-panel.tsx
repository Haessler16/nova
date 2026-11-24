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
import { RECORD_STATUS_COLORS, formatDateTime, recordStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
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
  const { t, locale } = useI18n();
  const { memberships } = data;

  return (
    <TabPanel px={0}>
      <SectionCard>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold">{t('admin.members.title')}</Text>
          <HStack>
            <Button size="sm" variant="ghost" onClick={memberships.reload}>
              {t('admin.members.refresh')}
            </Button>
            <Button size="sm" colorScheme="brand" onClick={onCreate}>
              {t('admin.members.create')}
            </Button>
          </HStack>
        </HStack>
        <QueryFeedback
          loading={memberships.loading}
          error={memberships.error}
          onRetry={memberships.reload}
          isEmpty={(memberships.data?.items.length ?? 0) === 0}
          emptyText={t('admin.members.empty')}
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>{t('admin.members.user')}</Th>
                  <Th>{t('admin.members.orgRole')}</Th>
                  <Th>{t('admin.members.properties')}</Th>
                  <Th>{t('admin.members.status')}</Th>
                  <Th>{t('admin.members.createdAt')}</Th>
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
                    <Td>{member.role?.name ?? t('admin.members.noRole')}</Td>
                    <Td>
                      <HStack spacing={1} wrap="wrap">
                        {member.propertyMemberships.length === 0 && (
                          <Text fontSize="xs" color="gray.500">
                            {t('admin.members.noAssignments')}
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
                        label={recordStatusLabel(locale, member.status)}
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
                          {t('admin.members.edit')}
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onProperties(member)}>
                          {t('admin.members.propertiesAction')}
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onSessions(member)}>
                          {t('admin.members.sessionsAction')}
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
