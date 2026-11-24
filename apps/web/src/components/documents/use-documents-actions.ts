'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { GeneratedDocumentSummary } from '@/lib/types';
import {
  confirmPhysicalSignature,
  downloadGeneratedDocument,
  openGeneratedDocument,
  registerPrintEvent,
  requestDocumentGeneration,
  requestDocumentPreview,
  type DocumentRequestContext,
} from './document-requests';
import type { DocumentsState } from './use-documents-state';

export function useDocumentsActions(state: DocumentsState, reservationId: string) {
  const { t } = useI18n();
  const toast = useToast();
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const context: DocumentRequestContext = {
    organizationId: state.organizationId,
    propertyId: state.propertyId,
    reservationId,
    type: state.type,
  };

  async function handlePreview(): Promise<void> {
    if (state.activeTemplate === null) {
      toast({ title: t('documents.toast.noTemplate'), status: 'warning' });
      return;
    }
    setPreviewing(true);
    state.setError(null);
    try {
      state.setPreview(await requestDocumentPreview(context, state.activeTemplate.id));
    } catch (cause) {
      state.setError(cause);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (state.activeTemplate === null) {
      return;
    }
    setGenerating(true);
    state.setError(null);
    try {
      const generated = await requestDocumentGeneration(context, state.activeTemplate.id);
      state.setSelected(generated);
      state.setHistory((current) => [generated, ...current]);
      toast({ title: t('documents.toast.generated'), status: 'success' });
      try {
        await downloadGeneratedDocument(context, generated);
      } catch (cause) {
        toast({
          title: t('documents.toast.downloadError'),
          description: errorMessage(cause),
          status: 'warning',
          duration: 8000,
        });
      }
      await state.load();
    } catch (cause) {
      state.setError(cause);
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpen(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    state.setError(null);
    try {
      await openGeneratedDocument(context, document);
      try {
        await registerPrintEvent(
          context,
          document,
          document.printEventCount === 0
            ? t('documents.note.printOpened')
            : t('documents.note.reprint'),
        );
        await state.load();
      } catch (cause) {
        toast({
          title: t('documents.toast.printEventError'),
          description: errorMessage(cause),
          status: 'warning',
          duration: 8000,
        });
      }
    } catch (cause) {
      state.setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDownload(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    state.setError(null);
    try {
      await downloadGeneratedDocument(context, document);
    } catch (cause) {
      state.setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleSignature(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    state.setError(null);
    try {
      const updated = await confirmPhysicalSignature(
        context,
        document,
        t('documents.note.signature'),
      );
      state.setSelected(updated);
      toast({ title: t('documents.toast.signature'), status: 'success' });
      await state.load();
    } catch (cause) {
      state.setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  return {
    previewing,
    generating,
    workingId,
    handlePreview,
    handleGenerate,
    handleOpen,
    handleDownload,
    handleSignature,
  };
}

export type DocumentsActions = ReturnType<typeof useDocumentsActions>;
