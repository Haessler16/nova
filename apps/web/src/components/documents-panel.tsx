'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { api, downloadFile, errorMessage, openProtectedPdf } from '@/lib/api';
import {
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  RESERVATION_DOCUMENT_LABELS,
  formatDateTime,
} from '@/lib/format';
import type {
  DocumentPreviewResponse,
  DocumentTemplateSummary,
  DocumentType,
  GeneratedDocumentSummary,
} from '@/lib/types';

const DOCUMENT_TYPES: DocumentType[] = ['GUEST_REGISTRATION', 'LODGING_TERMS', 'CHECKIN_SUMMARY'];

interface ReservationDocumentsProps {
  reservationId: string;
  reservationCode: string;
}

export function ReservationDocuments({
  reservationId,
  reservationCode,
}: ReservationDocumentsProps) {
  const modal = useDisclosure();
  const toast = useToast();
  const { organizationId, propertyId } = useSession();

  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [history, setHistory] = useState<GeneratedDocumentSummary[]>([]);
  const [type, setType] = useState<DocumentType>('GUEST_REGISTRATION');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<DocumentPreviewResponse | null>(null);
  const [selected, setSelected] = useState<GeneratedDocumentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
          `/api/v1/documents?reservationId=${encodeURIComponent(reservationId)}`,
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
  }, [organizationId, propertyId, reservationId, type]);

  useEffect(() => {
    if (modal.isOpen) {
      void load();
    }
  }, [load, modal.isOpen]);

  const availableTemplates = templates.filter((item) => item.key === type);
  const activeTemplate =
    availableTemplates.find((item) => item.id === templateId) ?? availableTemplates[0] ?? null;

  function changeType(next: DocumentType): void {
    setType(next);
    setPreview(null);
    setSelected(null);
    const available = templates.filter((item) => item.key === next);
    setTemplateId(available[0]?.id ?? '');
  }

  async function handlePreview(): Promise<void> {
    if (activeTemplate === null) {
      toast({ title: 'No hay una plantilla publicada para este tipo', status: 'warning' });
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const result = await api<DocumentPreviewResponse>('/api/v1/documents/preview', {
        method: 'POST',
        tenant: { organizationId, propertyId },
        body: { type, reservationId, templateId: activeTemplate.id },
      });
      setPreview(result);
    } catch (cause) {
      setError(cause);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (activeTemplate === null) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const generated = await api<GeneratedDocumentSummary>('/api/v1/documents', {
        method: 'POST',
        tenant: { organizationId, propertyId },
        body: { type, reservationId, templateId: activeTemplate.id },
      });
      setSelected(generated);
      setHistory((current) => [generated, ...current]);
      toast({ title: 'Documento generado', status: 'success' });
      try {
        await downloadFile(
          `/api/v1/documents/${generated.id}/download`,
          { organizationId, propertyId },
          `${generated.number}.pdf`,
        );
      } catch (cause) {
        toast({
          title: 'El PDF se generó, pero no se pudo descargar',
          description: errorMessage(cause),
          status: 'warning',
          duration: 8000,
        });
      }
      await load();
    } catch (cause) {
      setError(cause);
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpen(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    setError(null);
    try {
      await openProtectedPdf(
        `/api/v1/documents/${document.id}/download`,
        { organizationId, propertyId },
        `${document.number}.pdf`,
      );
      try {
        await api(`/api/v1/documents/${document.id}/print-events`, {
          method: 'POST',
          tenant: { organizationId, propertyId },
          body: {
            type: document.printEventCount === 0 ? 'PRINT_DIALOG_OPENED' : 'REPRINT_REQUESTED',
            note:
              document.printEventCount === 0
                ? 'Apertura del PDF para impresión desde la reserva.'
                : 'Reimpresión solicitada desde la reserva.',
          },
        });
        await load();
      } catch (cause) {
        toast({
          title: 'El PDF se abrió, pero no se pudo registrar el evento de impresión',
          description: errorMessage(cause),
          status: 'warning',
          duration: 8000,
        });
      }
    } catch (cause) {
      setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDownload(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    setError(null);
    try {
      await downloadFile(
        `/api/v1/documents/${document.id}/download`,
        { organizationId, propertyId },
        `${document.number}.pdf`,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleSignature(document: GeneratedDocumentSummary): Promise<void> {
    setWorkingId(document.id);
    setError(null);
    try {
      const updated = await api<GeneratedDocumentSummary>(
        `/api/v1/documents/${document.id}/physical-signature-received`,
        {
          method: 'POST',
          tenant: { organizationId, propertyId },
          body: { notes: 'Recepción física registrada desde la reserva.' },
        },
      );
      setSelected(updated);
      toast({ title: 'Firma física registrada', status: 'success' });
      await load();
    } catch (cause) {
      setError(cause);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <>
      <Button size="xs" variant="outline" onClick={modal.onOpen}>
        Documentos
      </Button>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="1180px">
          <ModalHeader>
            Documentos de la reserva {reservationCode}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
              Vista previa A4, PDF privado y trazabilidad de impresión y firma física.
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {error !== null && (
              <Box
                mb={4}
                borderWidth="1px"
                borderColor="danger.200"
                bg="danger.50"
                p={3}
                rounded="md"
              >
                <Text fontSize="sm" color="danger.700">
                  {errorMessage(error)}
                </Text>
              </Box>
            )}

            {loading ? (
              <HStack justify="center" py={10}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="gray.500">
                  Cargando plantillas e historial…
                </Text>
              </HStack>
            ) : (
              <>
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                  <Stack spacing={4}>
                    <Box>
                      <Text fontWeight="semibold" mb={2}>
                        Nuevo documento
                      </Text>
                      <Text fontSize="sm" color="gray.600" mb={3}>
                        Elegí un tipo, revisá la vista previa y recién después generá el PDF.
                      </Text>
                      <Stack spacing={3}>
                        <Box>
                          <Text fontSize="xs" color="gray.500" mb={1}>
                            Tipo de documento
                          </Text>
                          <Select
                            value={type}
                            onChange={(event) => changeType(event.target.value as DocumentType)}
                          >
                            {DOCUMENT_TYPES.map((item) => (
                              <option key={item} value={item}>
                                {RESERVATION_DOCUMENT_LABELS[item]}
                              </option>
                            ))}
                          </Select>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500" mb={1}>
                            Plantilla publicada
                          </Text>
                          <Select
                            value={activeTemplate?.id ?? ''}
                            onChange={(event) => {
                              setTemplateId(event.target.value);
                              setPreview(null);
                            }}
                            isDisabled={availableTemplates.length === 0}
                          >
                            {availableTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name} · v{template.version} · {template.locale}
                              </option>
                            ))}
                          </Select>
                          {availableTemplates.length === 0 && (
                            <Text fontSize="xs" color="warning.600" mt={1}>
                              No hay una plantilla publicada para este tipo en la propiedad.
                            </Text>
                          )}
                        </Box>
                        <HStack>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handlePreview()}
                            isLoading={previewing}
                            isDisabled={activeTemplate === null}
                          >
                            Vista previa
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="brand"
                            onClick={() => void handleGenerate()}
                            isLoading={generating}
                            isDisabled={activeTemplate === null || preview === null}
                          >
                            Generar PDF
                          </Button>
                        </HStack>
                        {preview === null && activeTemplate !== null && (
                          <Text fontSize="xs" color="gray.500">
                            Generá la vista previa para habilitar la emisión.
                          </Text>
                        )}
                        {activeTemplate?.signatureRequired === true && (
                          <Text fontSize="xs" color="gray.500">
                            Este documento incluye líneas de firma. La firma física se registra
                            después, desde el historial.
                          </Text>
                        )}
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="semibold">Historial</Text>
                        <Text fontSize="xs" color="gray.500">
                          {history.length} documento(s)
                        </Text>
                      </HStack>
                      {history.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">
                          Todavía no hay documentos generados para esta reserva.
                        </Text>
                      ) : (
                        <Stack spacing={2} maxH="340px" overflowY="auto" pr={1}>
                          {history.map((document) => (
                            <Box
                              key={document.id}
                              borderWidth="1px"
                              borderColor={selected?.id === document.id ? 'brand.300' : 'gray.200'}
                              rounded="md"
                              p={3}
                              bg={selected?.id === document.id ? 'brand.50' : 'white'}
                            >
                              <HStack justify="space-between" align="start">
                                <Box>
                                  <Text fontSize="sm" fontWeight="medium">
                                    {RESERVATION_DOCUMENT_LABELS[document.documentType]}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500" fontFamily="mono">
                                    {document.number}
                                  </Text>
                                </Box>
                                <Badge colorScheme={DOCUMENT_STATUS_COLORS[document.status]}>
                                  {DOCUMENT_STATUS_LABELS[document.status]}
                                </Badge>
                              </HStack>
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                {formatDateTime(document.generatedAt)} · v{document.templateVersion}{' '}
                                · {document.pageCount} pág.
                              </Text>
                              <HStack mt={2} spacing={2} wrap="wrap">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => void handleOpen(document)}
                                  isLoading={workingId === document.id}
                                >
                                  Abrir PDF
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => void handleDownload(document)}
                                  isDisabled={workingId === document.id}
                                >
                                  Descargar
                                </Button>
                                {document.status === 'GENERATED' && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="mint"
                                    onClick={() => void handleSignature(document)}
                                    isDisabled={workingId === document.id}
                                  >
                                    Registrar firma física
                                  </Button>
                                )}
                              </HStack>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Stack>

                  <Box>
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">Vista previa A4</Text>
                      {preview !== null && (
                        <Text fontSize="xs" color="gray.500">
                          {preview.template.name} · v{preview.template.version}
                        </Text>
                      )}
                    </HStack>
                    {preview === null ? (
                      <Box
                        borderWidth="1px"
                        borderStyle="dashed"
                        borderColor="gray.300"
                        rounded="md"
                        minH={{ base: '320px', lg: '560px' }}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        p={6}
                      >
                        <Text fontSize="sm" color="gray.500" textAlign="center">
                          La vista previa se renderiza en el servidor con una plantilla versionada.
                          No se guarda ningún PDF hasta que confirmes la generación.
                        </Text>
                      </Box>
                    ) : (
                      <Box
                        as="iframe"
                        title="Vista previa del documento"
                        srcDoc={preview.html}
                        sandbox=""
                        w="100%"
                        h={{ base: '420px', lg: '620px' }}
                        borderWidth="1px"
                        borderColor="gray.200"
                        rounded="md"
                        bg="white"
                      />
                    )}
                    {selected !== null && (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        Último documento generado: {selected.number} · SHA-256{' '}
                        {selected.sha256.slice(0, 12)}…
                      </Text>
                    )}
                  </Box>
                </SimpleGrid>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={modal.onClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
