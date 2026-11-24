'use client';

import { useDisclosure } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type {
  DocumentPreviewResponse,
  DocumentTemplateSummary,
  DocumentType,
  GeneratedDocumentSummary,
  Reservation,
} from '@/lib/types';

export function useDocumentsState({
  reservationId,
  reservations,
  defaultOpen,
}: {
  reservationId: string;
  reservations: Reservation[] | undefined;
  defaultOpen: boolean;
}) {
  const modal = useDisclosure({ defaultIsOpen: defaultOpen });
  const { organizationId, propertyId } = useSession();
  const [activeReservationId, setActiveReservationId] = useState(reservationId);

  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [history, setHistory] = useState<GeneratedDocumentSummary[]>([]);
  const [type, setType] = useState<DocumentType>('GUEST_REGISTRATION');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<DocumentPreviewResponse | null>(null);
  const [selected, setSelected] = useState<GeneratedDocumentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [templateResponse, historyResponse] = await Promise.all([
        api<{ items: DocumentTemplateSummary[] }>('/api/v1/documents/templates', {
          tenant: { organizationId, propertyId },
        }),
        api<{ items: GeneratedDocumentSummary[] }>(
          `/api/v1/documents?reservationId=${encodeURIComponent(activeReservationId)}`,
          { tenant: { organizationId, propertyId } },
        ),
      ]);
      setTemplates(templateResponse.items);
      setHistory(historyResponse.items);
      setTemplateId((current) => {
        const available = templateResponse.items.filter((item) => item.key === type);
        return available.some((item) => item.id === current) ? current : (available[0]?.id ?? '');
      });
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [organizationId, propertyId, activeReservationId, type]);

  useEffect(() => {
    if (modal.isOpen) {
      void load();
    }
  }, [load, modal.isOpen]);

  const availableTemplates = templates.filter((item) => item.key === type);
  const activeTemplate =
    availableTemplates.find((item) => item.id === templateId) ?? availableTemplates[0] ?? null;
  const activeReservation =
    reservations?.find((reservation) => reservation.id === activeReservationId) ?? null;

  function changeReservation(next: string): void {
    setActiveReservationId(next);
    setPreview(null);
    setSelected(null);
    setHistory([]);
  }

  function changeType(next: DocumentType): void {
    setType(next);
    setPreview(null);
    setSelected(null);
    const available = templates.filter((item) => item.key === next);
    setTemplateId(available[0]?.id ?? '');
  }

  return {
    modal,
    organizationId,
    propertyId,
    activeReservationId,
    activeReservation,
    templates,
    availableTemplates,
    activeTemplate,
    history,
    setHistory,
    type,
    templateId,
    setTemplateId,
    preview,
    setPreview,
    selected,
    setSelected,
    loading,
    error,
    setError,
    load,
    changeReservation,
    changeType,
  };
}

export type DocumentsState = ReturnType<typeof useDocumentsState>;
