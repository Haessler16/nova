'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Button,
  HStack,
  Input,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useState, type ChangeEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { GuestImportPreview, GuestImportResult } from '@/lib/guest-import-types';
import { useAsyncData } from '@/lib/use-async-data';

const TEMPLATE = [
  'fullName,email,phone,documentType,documentNumber,notes',
  'Ana Silva,ana.silva@example.test,+55 11 90000-0000,PASSPORT,AB123456,Cliente sintético',
].join('\n');

function ImportsContent() {
  const { tenant } = useSession();
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<GuestImportPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<GuestImportResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [online, setOnline] = useState(true);

  // Keep a stable placeholder call so the import page reuses the project loader
  // contract without fetching a list.
  const { data: tenantKey } = useAsyncData(
    () => Promise.resolve(`${tenant.organizationId}:${tenant.propertyId}`),
    `${tenant.organizationId}:${tenant.propertyId}:imports`,
  );

  useEffect(() => {
    function update(): void {
      setOnline(navigator.onLine);
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function resetPreview(): void {
    setPreview(null);
    setIdempotencyKey(null);
    setResult(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    if (file.size > 512 * 1024) {
      toast({ title: 'El archivo supera 512 KB', status: 'error' });
      return;
    }
    setCsv(await file.text());
    resetPreview();
  }

  async function runPreview(): Promise<void> {
    setBusy('preview');
    try {
      const data = await api<GuestImportPreview>('/api/v1/guests/import/preview', {
        method: 'POST',
        tenant,
        body: { csv },
      });
      setPreview(data);
      setResult(null);
      setIdempotencyKey(crypto.randomUUID());
    } catch (cause) {
      toast({
        title: 'No se pudo leer el CSV',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  async function runCommit(): Promise<void> {
    if (preview === null || idempotencyKey === null || preview.invalidRows > 0) {
      return;
    }
    setBusy('commit');
    try {
      const data = await api<GuestImportResult>('/api/v1/guests/import', {
        method: 'POST',
        tenant,
        body: { csv, idempotencyKey },
      });
      setResult(data);
      setPreview(null);
      setIdempotencyKey(null);
      toast({
        title: data.replayed ? 'Importación ya confirmada' : 'Importación completada',
        description: `${data.createdCount} huéspedes creados.`,
        status: 'success',
      });
    } catch (cause) {
      toast({
        title: 'No se pudo importar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  const canPreview = csv.trim() !== '' && online && busy === null;
  const canCommit =
    preview !== null &&
    preview.invalidRows === 0 &&
    preview.totalRows > 0 &&
    online &&
    busy === null;

  return (
    <>
      <PageHeader
        title="Importaciones"
        description="Carga de huéspedes por CSV con vista previa y confirmación explícita. Nada se guarda hasta confirmar; la importación es todo o nada y la clave de idempotencia evita duplicados al reintentar."
        actions={
          <Button as={NextLink} href="/guests" size="sm" variant="outline">
            Ver huéspedes
          </Button>
        }
      />

      {!online && (
        <Alert status="warning" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            Sin conexión: podés preparar el archivo, pero la vista previa y la confirmación se
            habilitan al volver a estar en línea. No se encolan escrituras.
          </AlertDescription>
        </Alert>
      )}

      <SectionCard>
        <Stack spacing={4}>
          <HStack justify="space-between" wrap="wrap" spacing={2}>
            <Text fontSize="sm" color="gray.600">
              Columnas: fullName, email, phone, documentType, documentNumber, notes. Máximo 500
              filas y 512 KB. Delimitador coma o punto y coma.
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setCsv(TEMPLATE);
                resetPreview();
              }}
            >
              Usar plantilla
            </Button>
          </HStack>

          <Input
            type="file"
            accept=".csv,text/csv"
            size="sm"
            aria-label="Archivo CSV de huéspedes"
            onChange={(event) => void handleFile(event)}
          />

          <Textarea
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              resetPreview();
            }}
            rows={8}
            fontFamily="mono"
            fontSize="sm"
            placeholder={TEMPLATE}
            aria-label="Contenido CSV"
          />

          <HStack>
            <Button
              size="sm"
              colorScheme="brand"
              onClick={() => void runPreview()}
              isDisabled={!canPreview}
              isLoading={busy === 'preview'}
            >
              Vista previa
            </Button>
            <Button
              size="sm"
              colorScheme="green"
              onClick={() => void runCommit()}
              isDisabled={!canCommit}
              isLoading={busy === 'commit'}
            >
              Confirmar importación
            </Button>
            <Text fontSize="xs" color="gray.500">
              Clave de tenant: {tenantKey ?? '—'}
            </Text>
          </HStack>
        </Stack>
      </SectionCard>

      {result !== null && (
        <SectionCard>
          <Alert status={result.replayed ? 'info' : 'success'} borderRadius="md">
            <AlertIcon />
            <AlertDescription>
              {result.replayed
                ? 'Esta importación ya se había confirmado con la misma clave; no se crearon duplicados.'
                : `Se crearon ${result.createdCount} huéspedes.`}{' '}
              Importación <code>{result.importId}</code>.{' '}
              <Button as={NextLink} href="/guests" size="xs" variant="link">
                Revisar huéspedes
              </Button>
            </AlertDescription>
          </Alert>
        </SectionCard>
      )}

      {preview !== null && (
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
                      {row.values.documentType !== null && row.values.documentNumber !== null
                        ? `${row.values.documentType} ${row.values.documentNumber}`
                        : '—'}
                    </Td>
                    <Td>
                      {row.errors.length === 0 ? (
                        <Badge colorScheme="green">OK</Badge>
                      ) : (
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
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}
    </>
  );
}

export default function ImportsPage() {
  return (
    <PropertyGate>
      <ImportsContent />
    </PropertyGate>
  );
}
