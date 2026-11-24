'use client';

import { SimpleGrid, Stack } from '@chakra-ui/react';
import { PageHeader } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { SessionSummary } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { AccountIdentityCard } from './_components/account-identity-card';
import { AccountMembershipsCard } from './_components/account-memberships-card';
import { AccountMfaCard } from './_components/account-mfa-card';
import { AccountPasswordCard } from './_components/account-password-card';
import { AccountSessionsCard } from './_components/account-sessions-card';

function AccountContent() {
  const { authMode } = useSession();
  const { t } = useI18n();

  const sessions = useAsyncData<SessionSummary[]>(
    () => api<SessionSummary[]>('/api/v1/auth/sessions'),
    'account:sessions',
  );

  return (
    <>
      <PageHeader title={t('account.title')} description={t('account.description')} />

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
        <Stack spacing={6}>
          <AccountIdentityCard />
          <AccountSessionsCard
            sessions={sessions.data ?? []}
            loading={sessions.loading}
            error={sessions.error}
            onRetry={sessions.reload}
            onRevoked={sessions.reload}
          />
        </Stack>

        <Stack spacing={6}>
          {authMode === 'local-session' && (
            <>
              <AccountPasswordCard />
              <AccountMfaCard />
            </>
          )}
          <AccountMembershipsCard />
        </Stack>
      </SimpleGrid>
    </>
  );
}

export default function AccountPage() {
  return <AccountContent />;
}
