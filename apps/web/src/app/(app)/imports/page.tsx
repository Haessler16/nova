'use client';

import { Alert, AlertDescription, AlertIcon, Button } from '@chakra-ui/react';
import NextLink from 'next/link';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader } from '@/components/ui';
import { ImportEditorCard } from './_components/import-editor-card';
import { ImportPreviewCard } from './_components/import-preview-card';
import { ImportResultCard } from './_components/import-result-card';
import { useImportDraft } from './_hooks/use-import-draft';

function ImportsContent() {
  const draft = useImportDraft();

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

      {!draft.online && (
        <Alert status="warning" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            Sin conexión: podés preparar el archivo, pero la vista previa y la confirmación se
            habilitan al volver a estar en línea. No se encolan escrituras.
          </AlertDescription>
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
