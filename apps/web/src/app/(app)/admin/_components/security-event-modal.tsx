'use client';

import {
  Badge,
  Code,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { SEVERITY_COLORS, formatDateTime, formatJson } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { SecurityEvent } from '@/lib/types';

export function SecurityEventModal({
  isOpen,
  onClose,
  event,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: SecurityEvent | null;
}) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{t('admin.event.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {event !== null && (
            <Stack spacing={2}>
              <HStack>
                <Badge colorScheme={SEVERITY_COLORS[event.severity] ?? 'gray'}>
                  {event.severity}
                </Badge>
                <Code fontSize="xs">{event.type}</Code>
              </HStack>
              <Text fontSize="xs" color="gray.600">
                {t('admin.event.meta', {
                  date: formatDateTime(event.occurredAt),
                  user: event.userId ?? '—',
                  actor: event.actorUserId ?? '—',
                })}
              </Text>
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
