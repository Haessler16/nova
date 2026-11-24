'use client';

import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';

export function AccountMembershipsCard() {
  const { me } = useSession();
  const { t } = useI18n();

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={2}>
        {t('account.memberships.title')}
      </Text>
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>{t('account.memberships.organization')}</Th>
              <Th>{t('account.memberships.role')}</Th>
              <Th>{t('account.memberships.properties')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {me?.memberships.map((membership) => (
              <Tr key={membership.organization.id}>
                <Td>{membership.organization.name}</Td>
                <Td>{membership.role?.name ?? t('account.memberships.noRole')}</Td>
                <Td>{membership.properties.length}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </SectionCard>
  );
}
