'use client';

import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSession } from '@/context/session';
import { api, downloadReportExport, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { ReportDefinitionSummary, ReportKey, ReportResult } from '@/lib/types';

export function useReportRunner({
  selected,
  selectedDefinition,
  from,
  to,
  onRan,
}: {
  selected: ReportKey;
  selectedDefinition: ReportDefinitionSummary | null;
  from: string;
  to: string;
  onRan: () => void;
}) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState<'PDF' | 'CSV' | null>(null);

  function invalidPeriod(): boolean {
    if (from === '' || to === '' || from > to) {
      toast({ title: t('reports.toast.period'), status: 'warning' });
      return true;
    }
    return false;
  }

  async function runReport(page = 1): Promise<void> {
    if (selectedDefinition === null || !selectedDefinition.allowed) {
      return;
    }
    if (invalidPeriod()) {
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
      onRan();
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
    if (invalidPeriod()) {
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
        title: format === 'PDF' ? t('reports.toast.pdf') : t('reports.toast.csv'),
        status: 'success',
      });
      onRan();
    } catch (cause) {
      toast({
        title: t('reports.toast.exportError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(null);
    }
  }

  return { result, setResult, error, setError, running, exporting, runReport, exportReport };
}
