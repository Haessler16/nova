'use client';

import {
  Box,
  Button,
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
import { QueryFeedback } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { MemberSessions } from '../_hooks/use-member-sessions';

export function MemberSessionsModal({ sessions }: { sessions: MemberSessions }) {
  const { t } = useI18n();
  const memberSessions = sessions.sessions;

  return (
    <Modal isOpen={sessions.modal.isOpen} onClose={sessions.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('admin.sessions.title', { name: sessions.member?.user.name ?? '' })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <QueryFeedback
            loading={memberSessions.loading}
            error={memberSessions.error}
            onRetry={memberSessions.reload}
            isEmpty={(memberSessions.data?.items.length ?? 0) === 0}
            emptyText={t('admin.sessions.empty')}
          >
            <Stack spacing={2}>
              {memberSessions.data?.items.map((session) => (
                <HStack
                  key={session.id}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                >
                  <Box>
                    <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="360px">
                      {session.userAgent ?? t('admin.sessions.unknownClient')}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {t('admin.sessions.lastSeen', {
                        last: formatDateTime(session.lastSeenAt),
                        expires: formatDateTime(session.expiresAt),
                      })}
                    </Text>
                  </Box>
                  <Button size="xs" variant="outline" onClick={() => void sessions.revoke(session)}>
                    {t('admin.sessions.revoke')}
                  </Button>
                </HStack>
              ))}
            </Stack>
          </QueryFeedback>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
