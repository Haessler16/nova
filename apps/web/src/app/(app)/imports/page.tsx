'use client';

import { Alert, AlertDescription, AlertIcon, Button } from '@chakra-ui/react';
import NextLink from 'next/link';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { ImportEditorCard } from './_components/import-editor-card';
import { ImportPreviewCard } from './_components/import-preview-card';
import { ImportResultCard } from './_components/import-result-card';
import { useImportDraft } from './_hooks/use-import-draft';

function ImportsContent() {
  const { t } = useI18n();
  const draft = useImportDraft();

  return (
    <>
      <PageHeader
        title={t('imports.title')}
        description={t('imports.description')}
        actions={
          <Button as={NextLink} href="/guests" size="sm" variant="outline">
            {t('imports.viewGuests')}
          </Button>
        }
      />

      {!draft.online && (
        <Alert status="warning" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{t('imports.offline')}</AlertDescription>
        </Alert>
      )}

      <ImportEditorCard
        tenantKey={draft.tenantKey}
        csv={draft.csv}
        busy={draft.busy}
        canPreview={draft.canPreview}
        canCommit={draft.canCommit}
        onChangeCsv={draft.setCsv}
        onFile={(event) => void draft.loadFile(event)}
        onPreview={() => void draft.runPreview()}
        onCommit={() => void draft.runCommit()}
      />

      {draft.result !== null && <ImportResultCard result={draft.result} />}

      {draft.preview !== null && <ImportPreviewCard preview={draft.preview} />}
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
