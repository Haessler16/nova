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
  if (row.errors.length === 0) {
    return <Badge colorScheme="green">OK</Badge>;
  }

  return (
    <Stack spacing={1}>
      <Badge colorScheme="red" width="fit-content">
        Error
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
  return (
    <SectionCard>
      <HStack mb={3} spacing={3} wrap="wrap">
        <Text fontWeight="semibold">Vista previa</Text>
        <Badge colorScheme="gray">{preview.totalRows} filas</Badge>
        <Badge colorScheme="green">{preview.validRows} válidas</Badge>
        <Badge colorScheme={preview.invalidRows > 0 ? 'red' : 'gray'}>
          {preview.invalidRows} con errores
        </Badge>
        {preview.invalidRows > 0 && (
          <Text fontSize="xs" color="red.600">
            Corregí el CSV y volvé a generar la vista previa; no se puede confirmar con errores.
          </Text>
        )}
      </HStack>

      <TableContainer maxH="420px" overflowY="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Línea</Th>
              <Th>Nombre</Th>
              <Th>Contacto</Th>
              <Th>Documento</Th>
              <Th>Estado</Th>
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
                    {row.values.phone ?? 'sin teléfono'}
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
