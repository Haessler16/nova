'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DateField } from '@/components/date-field';
import { DownloadIcon, ReportsIcon } from '@/components/icons';
import {
  EmptyState,
  Field,
  MetricCard,
  PageHeader,
  QueryFeedback,
  SectionCard,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, downloadReportExport, errorMessage } from '@/lib/api';
import {
  addDaysISO,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
  todayISO,
} from '@/lib/format';
import type {
  ReportCellFormat,
  ReportDefinitionSummary,
  ReportExecution,
  ReportKey,
  ReportResult,
  ReportSummaryItem,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface ReportCatalog {
  items: ReportDefinitionSummary[];
}

interface ReportHistory {
  items: ReportExecution[];
}

function formatCell(
  value: string | number | null | undefined,
  format: ReportCellFormat,
  currencyCode: string,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (format === 'currency') {
    return formatMoney(String(value), currencyCode);
  }
  if (format === 'percent') {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toFixed(2)}%` : String(value);
  }
  if (format === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount)
      : String(value);
  }
  if (format === 'date') {
    return formatCalendarDate(String(value));
  }
  return String(value);
}

function formatSummary(item: ReportSummaryItem, currencyCode: string): string {
  if (item.value === null) {
    return '—';
  }
  return formatCell(item.value, item.format, currencyCode);
}

function ReportsContent() {
  const { tenant } = useSession();
  const toast = useToast();
  const [selected, setSelected] = useState<ReportKey>('occupancy');
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6));
  const [to, setTo] = useState(todayISO());
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState<'PDF' | 'CSV' | null>(null);

  const catalog = useAsyncData<ReportCatalog>(
    () => api<ReportCatalog>('/api/v1/reports', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:reports:catalog`,
  );
  const history = useAsyncData<ReportHistory>(
    () => api<ReportHistory>('/api/v1/reports/executions', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:reports:history`,
  );

  const selectedDefinition = catalog.data?.items.find((item) => item.key === selected) ?? null;
  const canRun = selectedDefinition?.allowed === true;

  function selectReport(key: ReportKey): void {
    setSelected(key);
    setResult(null);
    setError(null);
  }

  async function runReport(page = 1): Promise<void> {
    if (selectedDefinition === null || !selectedDefinition.allowed) {
      return;
    }
    if (from === '' || to === '' || from > to) {
      toast({ title: 'Elegí un período válido', status: 'warning' });
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const data = await api<ReportResult>(`/api/v1/reports/${selected}/run`, {
        method: 'POST',
        tenant,
        body: { filters: { from, to }, page, pageSize: 50 },
      });
      setResult(data);
      history.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setRunning(false);
    }
  }

  async function exportReport(format: 'PDF' | 'CSV'): Promise<void> {
    if (selectedDefinition === null || !selectedDefinition.allowed) {
      return;
    }
    if (from === '' || to === '' || from > to) {
      toast({ title: 'Elegí un período válido', status: 'warning' });
      return;
    }

    setExporting(format);
    try {
      await downloadReportExport(
        `/api/v1/reports/${selected}/exports`,
        tenant,
        { format, filters: { from, to } },
        `nova-report-${selected}-${from}-${to}.${format === 'PDF' ? 'pdf' : 'csv'}`,
      );
      toast({
        title: format === 'PDF' ? 'PDF generado' : 'CSV generado',
        status: 'success',
      });
      history.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo exportar el reporte',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(null);
    }
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary ?? [];
  const canExport = result !== null && canRun;

  return (
    <>
      <PageHeader
        eyebrow="Operación y finanzas"
        title="Reportes"
        description="Consultas fijas por propiedad, con período y zona horaria explícitos. Los reportes operativos no exponen datos innecesarios; la caja separa efectivo de pagos registrados por otros medios."
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportReport('CSV')}
              isLoading={exporting === 'CSV'}
              isDisabled={!canExport}
            >
              CSV
            </Button>
            <Button
              size="sm"
              colorScheme="brand"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportReport('PDF')}
              isLoading={exporting === 'PDF'}
              isDisabled={!canExport}
            >
              PDF
            </Button>
          </HStack>
        }
      />

      <SectionCard mb={5}>
        <HStack justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
          <HStack spacing={3}>
            <Flex
              boxSize="38px"
              align="center"
              justify="center"
              borderRadius="lg"
              bg="brand.50"
              color="brand.600"
            >
              <ReportsIcon boxSize={5} />
            </Flex>
            <Box>
              <Heading size="sm">Catálogo de reportes</Heading>
              <Text fontSize="xs" color="textSecondary">
                Períodos de hasta 62 días. Los importes se expresan en la moneda de la propiedad.
              </Text>
            </Box>
          </HStack>
          {selectedDefinition !== null && (
            <Badge colorScheme={selectedDefinition.allowed ? 'mint' : 'warning'}>
              {selectedDefinition.category}
            </Badge>
          )}
        </HStack>

        <QueryFeedback
          loading={catalog.loading}
          error={catalog.error}
          onRetry={catalog.reload}
          isEmpty={(catalog.data?.items.length ?? 0) === 0}
          emptyText="No hay reportes disponibles para tu rol."
        >
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={3} alignItems="end">
            <Field label="Reporte" isRequired>
              <Select
                size="sm"
                value={selected}
                onChange={(event) => selectReport(event.target.value as ReportKey)}
              >
                {(catalog.data?.items ?? []).map((item) => (
                  <option key={item.key} value={item.key} disabled={!item.allowed}>
                    {item.title}
                    {!item.allowed ? ' (sin permiso)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Desde" isRequired>
              <DateField value={from} onChange={setFrom} ariaLabel="Desde del reporte" />
            </Field>
            <Field label="Hasta" isRequired>
              <DateField value={to} onChange={setTo} ariaLabel="Hasta del reporte" />
            </Field>
            <Button
              colorScheme="brand"
              size="sm"
              onClick={() => void runReport(1)}
              isLoading={running}
              isDisabled={!canRun}
            >
              Generar reporte
            </Button>
          </SimpleGrid>

          {selectedDefinition !== null && (
            <Box mt={4} p={3} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="line">
              <Text fontSize="sm" fontWeight="semibold">
                {selectedDefinition.title}
              </Text>
              <Text fontSize="xs" color="textSecondary" mt={1}>
                {selectedDefinition.description}
              </Text>
              {!selectedDefinition.allowed && (
                <Text fontSize="xs" color="warning.700" mt={2}>
                  Tu rol no tiene el permiso {selectedDefinition.permission}. Pedile a un
                  administrador que lo asigne si necesitás este reporte.
                </Text>
              )}
            </Box>
          )}
        </QueryFeedback>
      </SectionCard>

      {result === null ? (
        <SectionCard>
                    {running ? (
            <QueryFeedback loading error={null}>
              <Box />
            </QueryFeedback>
          ) : error !== null ? (
            <QueryFeedback loading={false} error={error} onRetry={() => void runReport(1)}>
              <Box />
            </QueryFeedback>
          ) : (
            <EmptyState
              text="Elegí un reporte y generá una vista previa."
              hint="La ejecución queda registrada en auditoría con el período y la cantidad de filas, sin datos personales."
            />
          )}
        </SectionCard>
      ) : (
        <Stack spacing={5}>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
            {summary.map((item) => (
              <MetricCard
                key={item.key}
                label={item.label}
                value={formatSummary(item, result.currencyCode)}
                accent={item.format === 'currency' ? 'mint' : 'brand'}
              />
            ))}
          </SimpleGrid>

          <SectionCard>
            <HStack justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
              <Box>
                <Heading size="sm">{result.title}</Heading>
                <Text fontSize="xs" color="textSecondary" mt={1}>
                  {formatCalendarDate(result.filters.from)} a{' '}
                  {formatCalendarDate(result.filters.to)} · {result.timezone} · generado{' '}
                  {formatDateTime(result.generatedAt)}
                </Text>
              </Box>
              <Badge colorScheme="sky">{result.totalRows} fila(s)</Badge>
            </HStack>

            <QueryFeedback
              loading={running}
              error={error}
              onRetry={() => void runReport(result.page)}
              isEmpty={rows.length === 0}
              emptyText="No hay datos para los filtros seleccionados."
            >
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      {result.columns.map((column) => (
                        <Th key={column.key} isNumeric={column.align === 'right'}>
                          {column.label}
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.map((row, index) => (
                      <Tr key={`${result.executionId}-${index}`}>
                        {result.columns.map((column) => (
                          <Td
                            key={column.key}
                            isNumeric={column.align === 'right'}
                            whiteSpace={column.format === 'text' ? 'normal' : 'nowrap'}
                          >
                            {formatCell(row[column.key], column.format, result.currencyCode)}
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>

              <Divider my={4} />
              <Flex justify="space-between" align="center" gap={3} wrap="wrap">
                <Text fontSize="xs" color="textSecondary">
                  Página {result.page} de {Math.max(result.totalPages, 1)} · {result.totalRows}{' '}
                  fila(s) en total
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="outline"
                    isDisabled={result.page <= 1 || running}
                    onClick={() => void runReport(result.page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    isDisabled={result.page >= result.totalPages || running}
                    onClick={() => void runReport(result.page + 1)}
                  >
                    Siguiente
                  </Button>
                </HStack>
              </Flex>
            </QueryFeedback>
          </SectionCard>
        </Stack>
      )}

      <SectionCard mt={5}>
        <HStack justify="space-between" align="flex-start" mb={3}>
          <Box>
            <Heading size="sm">Historial reciente</Heading>
            <Text fontSize="xs" color="textSecondary" mt={1}>
              Ejecuciones y exportaciones auditadas de esta propiedad.
            </Text>
          </Box>
          <Button size="xs" variant="ghost" onClick={history.reload} isLoading={history.loading}>
            Actualizar
          </Button>
        </HStack>
        <QueryFeedback
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
          isEmpty={(history.data?.items.length ?? 0) === 0}
          emptyText="Todavía no hay ejecuciones registradas."
        >
          <Stack spacing={0}>
            {(history.data?.items ?? []).slice(0, 8).map((execution) => {
              const reportTitle =
                catalog.data?.items.find((item) => item.key === execution.metadata?.reportKey)
                  ?.title ?? execution.metadata?.reportKey;
              return (
                <Flex
                  key={execution.id}
                  justify="space-between"
                  gap={3}
                  py={2.5}
                  borderBottomWidth="1px"
                  borderColor="gray.100"
                  _last={{ borderBottomWidth: 0 }}
                  wrap="wrap"
                >
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">
                      {reportTitle ?? 'Reporte'} ·{' '}
                      {execution.action === 'report.exported' ? 'Exportación' : 'Ejecución'}
                    </Text>
                    <Text fontSize="xs" color="textSecondary">
                      {execution.metadata?.from !== undefined &&
                      execution.metadata?.to !== undefined
                        ? `${formatCalendarDate(execution.metadata.from)} a ${formatCalendarDate(execution.metadata.to)}`
                        : 'Período no disponible'}
                      {execution.metadata?.format !== undefined
                        ? ` · ${execution.metadata.format}`
                        : ''}
                      {execution.metadata?.rowCount !== undefined
                        ? ` · ${execution.metadata.rowCount} fila(s)`
                        : ''}
                    </Text>
                  </Box>
                  <Text fontSize="xs" color="textSecondary">
                    {formatDateTime(execution.occurredAt)}
                  </Text>
                </Flex>
              );
            })}
          </Stack>
        </QueryFeedback>
      </SectionCard>
    </>
  );
}

export default function ReportsPage() {
  return (
    <PropertyGate>
      <ReportsContent />
    </PropertyGate>
  );
}
