import { api, downloadFile, openProtectedPdf } from '@/lib/api';
import type { DocumentPreviewResponse, DocumentType, GeneratedDocumentSummary } from '@/lib/types';

export interface DocumentRequestContext {
  organizationId: string | null;
  propertyId: string | null;
  /** Reservation the document belongs to (the panel's original prop). */
  reservationId: string;
  type: DocumentType;
}

function tenantOf(context: DocumentRequestContext) {
  return { organizationId: context.organizationId, propertyId: context.propertyId };
}

export async function requestDocumentPreview(
  context: DocumentRequestContext,
  templateId: string,
): Promise<DocumentPreviewResponse> {
  return api<DocumentPreviewResponse>('/api/v1/documents/preview', {
    method: 'POST',
    tenant: tenantOf(context),
    body: { type: context.type, reservationId: context.reservationId, templateId },
  });
}

export async function requestDocumentGeneration(
  context: DocumentRequestContext,
  templateId: string,
): Promise<GeneratedDocumentSummary> {
  return api<GeneratedDocumentSummary>('/api/v1/documents', {
    method: 'POST',
    tenant: tenantOf(context),
    body: { type: context.type, reservationId: context.reservationId, templateId },
  });
}

export async function downloadGeneratedDocument(
  context: DocumentRequestContext,
  document: GeneratedDocumentSummary,
): Promise<void> {
  await downloadFile(
    `/api/v1/documents/${document.id}/download`,
    tenantOf(context),
    `${document.number}.pdf`,
  );
}

/** Opens the protected PDF in a new tab. */
export async function openGeneratedDocument(
  context: DocumentRequestContext,
  document: GeneratedDocumentSummary,
): Promise<void> {
  await openProtectedPdf(
    `/api/v1/documents/${document.id}/download`,
    tenantOf(context),
    `${document.number}.pdf`,
  );
}

/** Records the print/reprint audit event for an opened document. */
export async function registerPrintEvent(
  context: DocumentRequestContext,
  document: GeneratedDocumentSummary,
  note: string,
): Promise<void> {
  await api(`/api/v1/documents/${document.id}/print-events`, {
    method: 'POST',
    tenant: tenantOf(context),
    body: {
      type: document.printEventCount === 0 ? 'PRINT_DIALOG_OPENED' : 'REPRINT_REQUESTED',
      note,
    },
  });
}

export async function confirmPhysicalSignature(
  context: DocumentRequestContext,
  document: GeneratedDocumentSummary,
  notes: string,
): Promise<GeneratedDocumentSummary> {
  return api<GeneratedDocumentSummary>(
    `/api/v1/documents/${document.id}/physical-signature-received`,
    {
      method: 'POST',
      tenant: tenantOf(context),
      body: { notes },
    },
  );
}
