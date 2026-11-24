'use client';

import { Divider, Text } from '@chakra-ui/react';
import { SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { AccountMfaDisable } from './account-mfa-disable';
import { AccountMfaSetup } from './account-mfa-setup';

export function AccountMfaCard() {
  const { t } = useI18n();

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={1}>
        {t('account.mfa.title')}
      </Text>
      <Text fontSize="xs" color="gray.600" mb={3}>
        {t('account.mfa.description')}
      </Text>
      <AccountMfaSetup />
      <Divider my={4} />
      <AccountMfaDisable />
    </SectionCard>
  );
}
