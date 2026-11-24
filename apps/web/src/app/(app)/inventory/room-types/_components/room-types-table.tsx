'use client';

import {
  HStack,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { QueryFeedback, RowActionButton, StatusBadge } from '@/components/ui';
import { RECORD_STATUS_COLORS, recordStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { RoomType } from '@/lib/types';

export function RoomTypesTable({
  items,
  loading,
  error,
  onRetry,
  statusFilter,
  onStatusFilterChange,
  onEdit,
}: {
  items: RoomType[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onEdit: (roomType: RoomType) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <HStack mb={4} justify="space-between" wrap="wrap" spacing={3}>
        <HStack>
          <Text fontSize="sm" color="textSecondary">
            {t('roomTypes.filterLabel')}
          </Text>
          <Select
            size="sm"
            width="150px"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            <option value="">{t('roomTypes.filter.all')}</option>
            <option value="ACTIVE">{t('roomTypes.filter.active')}</option>
            <option value="DISABLED">{t('roomTypes.filter.disabled')}</option>
          </Select>
        </HStack>
        <Text fontSize="xs" color="textSecondary">
          {items.length === 1
            ? t('roomTypes.countOne')
            : t('roomTypes.countOther', { count: items.length })}
        </Text>
      </HStack>

      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        isEmpty={items.length === 0}
        emptyText={t('roomTypes.empty')}
      >
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('roomTypes.column.name')}</Th>
                <Th>{t('roomTypes.column.code')}</Th>
                <Th isNumeric>{t('roomTypes.column.adults')}</Th>
                <Th isNumeric>{t('roomTypes.column.children')}</Th>
                <Th>{t('roomTypes.column.bed')}</Th>
                <Th isNumeric>{t('roomTypes.column.rooms')}</Th>
                <Th>{t('roomTypes.column.status')}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {items.map((roomType) => (
                <Tr key={roomType.id}>
                  <Td>
                    <Text fontWeight="medium">{roomType.name}</Text>
                    {roomType.description !== null && (
                      <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="320px">
                        {roomType.description}
                      </Text>
                    )}
                  </Td>
                  <Td>
                    <Text as="code" fontSize="xs">
                      {roomType.code}
                    </Text>
                  </Td>
                  <Td isNumeric>{roomType.capacityAdults}</Td>
                  <Td isNumeric>{roomType.capacityChildren}</Td>
                  <Td>{roomType.bedType ?? '—'}</Td>
                  <Td isNumeric>{roomType.roomCount}</Td>
                  <Td>
                    <StatusBadge
                      color={RECORD_STATUS_COLORS[roomType.status] ?? 'gray'}
                      label={recordStatusLabel(locale, roomType.status)}
                    />
                  </Td>
                  <Td>
                    <RowActionButton onClick={() => onEdit(roomType)}>
                      {t('roomTypes.edit')}
                    </RowActionButton>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </QueryFeedback>
    </>
  );
}
