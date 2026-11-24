'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Code,
  HStack,
  Input,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { api, errorMessage, isApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface MfaSetup {
  secret: string;
  otpauthUri: string;
  issuer: string;
}

export function AccountMfaSetup() {
  const { t } = useI18n();
  const toast = useToast();

  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  async function startMfa(): Promise<void> {
    setMfaBusy(true);
    try {
      const setup = await api<MfaSetup>('/api/v1/auth/mfa/setup', { method: 'POST' });
      setMfaSetup(setup);
    } catch (cause) {
      toast({
        title: t('account.mfa.startError'),
        description:
          isApiError(cause) && cause.code === 'mfa_already_enabled'
            ? t('account.mfa.alreadyEnabled')
            : errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setMfaBusy(false);
    }
  }

  async function enableMfa(): Promise<void> {
    setMfaBusy(true);
    try {
      await api<void>('/api/v1/auth/mfa/enable', {
        method: 'POST',
        body: { code: mfaCode },
      });
      toast({ title: t('account.mfa.enabled'), status: 'success' });
      setMfaSetup(null);
      setMfaCode('');
    } catch (cause) {
      toast({
        title: t('account.mfa.invalidCode'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setMfaBusy(false);
    }
  }

  if (mfaSetup === null) {
    return (
      <Button size="sm" variant="outline" onClick={() => void startMfa()} isLoading={mfaBusy}>
        {t('account.mfa.configure')}
      </Button>
    );
  }

  return (
    <Stack spacing={3}>
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <AlertDescription fontSize="xs">
          {t('account.mfa.secret')} <Code>{mfaSetup.secret}</Code>
          <br />
          {t('account.mfa.uri')} <Code wordBreak="break-all">{mfaSetup.otpauthUri}</Code>
        </AlertDescription>
      </Alert>
      <HStack>
        <Input
          size="sm"
          placeholder={t('account.mfa.codePlaceholder')}
          value={mfaCode}
          maxLength={6}
          onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
        />
        <Button
          size="sm"
          colorScheme="brand"
          onClick={() => void enableMfa()}
          isLoading={mfaBusy}
          isDisabled={!/^\d{6}$/.test(mfaCode)}
        >
          {t('account.mfa.activate')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMfaSetup(null)}>
          {t('account.mfa.cancel')}
        </Button>
      </HStack>
    </Stack>
  );
}
