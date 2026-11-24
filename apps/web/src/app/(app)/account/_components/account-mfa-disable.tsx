'use client';

import { Button, HStack, Input, Stack, Text, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export function AccountMfaDisable() {
  const { t } = useI18n();
  const toast = useToast();

  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [busy, setBusy] = useState(false);

  async function disableMfa(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await api<void>('/api/v1/auth/mfa/disable', {
        method: 'POST',
        body: { password: disableForm.password, code: disableForm.code },
      });
      toast({ title: t('account.mfa.disabled'), status: 'success' });
      setDisableForm({ password: '', code: '' });
    } catch (cause) {
      toast({
        title: t('account.mfa.disableError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void disableMfa(event)}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        {t('account.mfa.disableTitle')}
      </Text>
      <Stack spacing={2}>
        <Input
          size="sm"
          type="password"
          placeholder={t('account.mfa.passwordPlaceholder')}
          value={disableForm.password}
          onChange={(event) => setDisableForm({ ...disableForm, password: event.target.value })}
          required
        />
        <HStack>
          <Input
            size="sm"
            placeholder={t('account.mfa.codePlaceholder')}
            value={disableForm.code}
            maxLength={6}
            onChange={(event) =>
              setDisableForm({
                ...disableForm,
                code: event.target.value.replace(/\D/g, ''),
              })
            }
            required
          />
          <Button type="submit" size="sm" variant="outline" isLoading={busy}>
            {t('account.mfa.disable')}
          </Button>
        </HStack>
      </Stack>
    </form>
  );
}
