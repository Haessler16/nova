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
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">Evento de seguridad</ModalHeader>
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
                {formatDateTime(event.occurredAt)} · usuario {event.userId ?? '—'} · actor{' '}
                {event.actorUserId ?? '—'}
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
