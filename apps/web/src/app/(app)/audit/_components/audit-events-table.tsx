'use client';

import {
  Badge,
  Button,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuditEvent } from '@/lib/types';

export function AuditEventsTable({
  items,
  onSelect,
}: {
  items: AuditEvent[];
  onSelect: (event: AuditEvent) => void;
}) {
  const { t } = useI18n();

  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>{t('audit.table.date')}</Th>
            <Th>{t('audit.table.action')}</Th>
            <Th>{t('audit.table.entity')}</Th>
            <Th>{t('audit.table.actor')}</Th>
            <Th>{t('audit.table.correlation')}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {items.map((event) => (
            <Tr key={event.id}>
              <Td whiteSpace="nowrap">
                <Text fontSize="xs">{formatDateTime(event.occurredAt)}</Text>
              </Td>
              <Td>
                <Text as="code" fontSize="xs" fontWeight="semibold">
                  {event.action}
                </Text>
                {event.reason !== null && (
                  <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="280px">
                    {event.reason}
                  </Text>
                )}
              </Td>
              <Td>
                <Badge colorScheme="brand" textTransform="none">
                  {event.entityType}
                </Badge>
                <Text fontFamily="mono" fontSize="xs" color="textSecondary">
                  {event.entityId.slice(0, 8)}…
                </Text>
              </Td>
              <Td>
                <Text fontFamily="mono" fontSize="xs">
                  {event.actorUserId !== null
                    ? `${event.actorUserId.slice(0, 8)}…`
                    : t('audit.system')}
                </Text>
              </Td>
              <Td>
                <Text fontFamily="mono" fontSize="xs" color="textSecondary">
                  {event.correlationId !== null ? `${event.correlationId.slice(0, 8)}…` : '—'}
                </Text>
              </Td>
              <Td>
                <Button size="xs" variant="ghost" onClick={() => onSelect(event)}>
                  {t('audit.table.detail')}
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
