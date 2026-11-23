'use client';

import { Alert, AlertDescription, AlertIcon, Box, Heading, Text } from '@chakra-ui/react';
import { ErrorAlert } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { LoginFlow } from '../_hooks/use-login-flow';
import { LoginDevUsers } from './login-dev-users';
import { LoginLocalForm } from './login-local-form';

export function LoginCard({ flow }: { flow: LoginFlow }) {
  const { t } = useI18n();

  return (
    <Box
      bg="surface"
      borderWidth="1px"
      borderColor="line"
      borderRadius="2xl"
      p={{ base: 5, md: 7 }}
      boxShadow="card"
    >
      <Heading size="md" mb={1}>
        {t('login.title')}
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={5}>
        {flow.authMode === 'local-session'
          ? t('login.subtitle.local')
          : flow.authMode === 'dev-header'
            ? t('login.subtitle.dev')
            : t('login.subtitle.disabled')}
      </Text>

      {flow.error !== null && (
        <Box mb={4}>
          <ErrorAlert error={flow.error} />
        </Box>
      )}

      {flow.authMode === 'local-session' && <LoginLocalForm flow={flow} />}

      {flow.authMode === 'dev-header' && <LoginDevUsers flow={flow} />}

      {flow.authMode === 'disabled' && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <AlertDescription fontSize="sm">{t('login.disabled.alert')}</AlertDescription>
        </Alert>
      )}
    </Box>
  );
}
