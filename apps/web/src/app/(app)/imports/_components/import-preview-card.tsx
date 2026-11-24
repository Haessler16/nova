'use client';

import {
  Badge,
  HStack,
  Stack,
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
import { useI18n } from '@/lib/i18n';
import type { GuestImportPreview } from '@/lib/guest-import-types';

type PreviewRow = GuestImportPreview['rows'][number];

function DocumentCell({ row }: { row: PreviewRow }) {
  return (
    <>
      {row.values.documentType !== null && row.values.documentNumber !== null
        ? `${row.values.documentType} ${row.values.documentNumber}`
        : '—'}
    </>
  );
}

function StatusCell({ row }: { row: PreviewRow }) {
  const { t } = useI18n();

  if (row.errors.length === 0) {
    return <Badge colorScheme="green">OK</Badge>;
  }

  return (
    <Stack spacing={1}>
      <Badge colorScheme="red" width="fit-content">
        {t('imports.preview.error')}
      </Badge>
      {row.errors.map((message) => (
        <Text key={message} fontSize="xs" color="red.600">
          {message}
        </Text>
      ))}
    </Stack>
  );
}

export function ImportPreviewCard({ preview }: { preview: GuestImportPreview }) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <HStack mb={3} spacing={3} wrap="wrap">
        <Text fontWeight="semibold">{t('imports.preview.title')}</Text>
        <Badge colorScheme="gray">{t('imports.preview.rows', { count: preview.totalRows })}</Badge>
        <Badge colorScheme="green">
          {t('imports.preview.valid', { count: preview.validRows })}
        </Badge>
        <Badge colorScheme={preview.invalidRows > 0 ? 'red' : 'gray'}>
          {t('imports.preview.invalid', { count: preview.invalidRows })}
        </Badge>
        {preview.invalidRows > 0 && (
          <Text fontSize="xs" color="red.600">
            {t('imports.preview.correct')}
          </Text>
        )}
      </HStack>

      <TableContainer maxH="420px" overflowY="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>{t('imports.table.line')}</Th>
              <Th>{t('imports.table.name')}</Th>
              <Th>{t('imports.table.contact')}</Th>
              <Th>{t('imports.table.document')}</Th>
              <Th>{t('imports.table.status')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {preview.rows.map((row) => (
              <Tr key={row.line}>
                <Td>{row.line}</Td>
                <Td>{row.values.fullName === '' ? '—' : row.values.fullName}</Td>
                <Td>
                  <Text fontSize="sm">{row.values.email ?? '—'}</Text>
                  <Text fontSize="xs" color="gray.500">
                    {row.values.phone ?? t('imports.preview.noPhone')}
                  </Text>
                </Td>
                <Td>
                  <DocumentCell row={row} />
                </Td>
                <Td>
                  <StatusCell row={row} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </SectionCard>
  );
}
