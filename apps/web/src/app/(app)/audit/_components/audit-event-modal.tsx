'use client';

import {
  Code,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { formatDateTime, formatJson } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { AuditEvent } from '@/lib/types';

export function AuditEventModal({
  isOpen,
  onClose,
  event,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: AuditEvent | null;
}) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{t('audit.modal.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {event !== null && (
            <Stack spacing={3}>
              <Text fontSize="sm" fontWeight="semibold">
                {event.action}
              </Text>
              <Text fontSize="xs" color="textSecondary">
                {event.entityType} · {event.entityId}
              </Text>
              <Text fontSize="xs" color="textSecondary">
                {formatDateTime(event.occurredAt)} ·{' '}
                {t('audit.modal.actor', { actor: event.actorUserId ?? t('audit.system') })} ·{' '}
                {t('audit.modal.correlation', { correlation: event.correlationId ?? '—' })}
              </Text>
              {event.reason !== null && (
                <Text fontSize="sm">{t('audit.modal.reason', { reason: event.reason })}</Text>
              )}
              <Code display="block" whiteSpace="pre-wrap" p={3} borderRadius="md" fontSize="xs">
                {formatJson(event.metadata)}
              </Code>
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
