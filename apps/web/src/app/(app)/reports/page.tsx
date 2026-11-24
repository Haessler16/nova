'use client';

import { Button, HStack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DownloadIcon } from '@/components/icons';
import { PageHeader } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { addDaysISO, todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type {
  OperationalDay,
  ReportDefinitionSummary,
  ReportExecution,
  ReportKey,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { ReportControls } from './_components/report-controls';
import { ReportHistory } from './_components/report-history';
import { ReportResultPanel } from './_components/report-result';
import { useReportRunner } from './_lib/use-report-runner';

interface ReportCatalog {
  items: ReportDefinitionSummary[];
}

interface ReportHistoryItems {
  items: ReportExecution[];
}

function ReportsContent() {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const propertyTimezone = property?.timezone;
  const [selected, setSelected] = useState<ReportKey>('occupancy');
  const [from, setFrom] = useState(addDaysISO(todayISO(0, propertyTimezone), -6));
  const [to, setTo] = useState(todayISO(0, propertyTimezone));
  const datesTouched = useRef(false);

  const operationalDay = useAsyncData<OperationalDay>(
    () => api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:reports:operational-day`,
  );
  const catalog = useAsyncData<ReportCatalog>(
    () => api<ReportCatalog>('/api/v1/reports', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:reports:catalog`,
  );
  const history = useAsyncData<ReportHistoryItems>(
    () => api<ReportHistoryItems>('/api/v1/reports/executions', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:reports:history`,
  );

  useEffect(() => {
    const date = operationalDay.data?.operationalDate;
    if (date === undefined || datesTouched.current) {
      return;
    }
    setFrom(addDaysISO(date, -6));
    setTo(date);
  }, [operationalDay.data?.operationalDate]);

  const selectedDefinition = catalog.data?.items.find((item) => item.key === selected) ?? null;
  const canRun = selectedDefinition?.allowed === true;

  const { result, setResult, error, setError, running, exporting, runReport, exportReport } =
    useReportRunner({
      selected,
      selectedDefinition,
      from,
      to,
      onRan: history.reload,
    });

  const canExport = result !== null && canRun;

  return (
    <>
      <PageHeader
        eyebrow={t('reports.eyebrow')}
        title={t('reports.title')}
        description={t('reports.description')}
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

      <ReportControls
        items={catalog.data?.items ?? []}
        loading={catalog.loading}
        error={catalog.error}
        onRetry={catalog.reload}
        selected={selected}
        onSelect={(key) => {
          setSelected(key);
          setResult(null);
          setError(null);
        }}
        from={from}
        to={to}
        onFromChange={(value) => {
          datesTouched.current = true;
          setFrom(value);
        }}
        onToChange={(value) => {
          datesTouched.current = true;
          setTo(value);
        }}
        running={running}
        canRun={canRun}
        onRun={() => void runReport(1)}
        selectedDefinition={selectedDefinition}
      />

      <ReportResultPanel
        result={result}
        error={error}
        running={running}
        onRun={(page) => void runReport(page)}
      />

      <ReportHistory
        executions={history.data?.items ?? []}
        definitions={catalog.data?.items ?? []}
        loading={history.loading}
        error={history.error}
        onReload={history.reload}
      />
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
