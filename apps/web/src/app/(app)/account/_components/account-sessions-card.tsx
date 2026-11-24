'use client';

import { Badge, Box, Button, HStack, Stack, Text, useToast } from '@chakra-ui/react';
import { QueryFeedback, SectionCard } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { SessionSummary } from '@/lib/types';

export function AccountSessionsCard({
  sessions,
  loading,
  error,
  onRetry,
  onRevoked,
}: {
  sessions: SessionSummary[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
  onRevoked: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();

  async function revokeSession(session: SessionSummary): Promise<void> {
    try {
      await api<void>(`/api/v1/auth/sessions/${session.id}`, { method: 'DELETE' });
      toast({ title: t('account.sessions.revoked'), status: 'success' });
      onRevoked();
    } catch (cause) {
      toast({
        title: t('account.sessions.revokeError'),
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={3}>
        {t('account.sessions.title')}
      </Text>
      <QueryFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        isEmpty={sessions.length === 0}
        emptyText={t('account.sessions.empty')}
      >
        <Stack spacing={2}>
          {sessions.map((session) => (
            <HStack
              key={session.id}
              justify="space-between"
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
              align="flex-start"
            >
              <Box>
                <HStack spacing={2}>
                  {session.current === true && (
                    <Badge colorScheme="mint">{t('account.sessions.current')}</Badge>
                  )}
                  <Text fontSize="xs" color="gray.600">
                    {t('account.sessions.lastSeen', {
                      date: formatDateTime(session.lastSeenAt),
                    })}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="320px">
                  {session.userAgent ?? t('account.sessions.unknownClient')}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {t('account.sessions.expires', { date: formatDateTime(session.expiresAt) })}
                </Text>
              </Box>
              {session.current !== true && (
                <Button size="xs" variant="outline" onClick={() => void revokeSession(session)}>
                  {t('account.sessions.revoke')}
                </Button>
              )}
            </HStack>
          ))}
        </Stack>
      </QueryFeedback>
      <Text fontSize="xs" color="gray.500" mt={3}>
        {t('account.sessions.revokeHint')}
      </Text>
    </SectionCard>
  );
}
