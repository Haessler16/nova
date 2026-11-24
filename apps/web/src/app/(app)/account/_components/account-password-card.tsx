'use client';

import { Button, Input, Stack, Text, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field, SectionCard } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export function AccountPasswordCard() {
  const { t } = useI18n();
  const toast = useToast();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  async function changePassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: t('account.password.mismatch'), status: 'warning' });
      return;
    }
    setChangingPassword(true);
    try {
      await api<void>('/api/v1/auth/password/change', {
        method: 'POST',
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      toast({ title: t('account.password.updated'), status: 'success' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (cause) {
      toast({
        title: t('account.password.error'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={3}>
        {t('account.password.title')}
      </Text>
      <form onSubmit={(event) => void changePassword(event)}>
        <Stack spacing={3}>
          <Field label={t('account.password.current')} isRequired>
            <Input
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, currentPassword: event.target.value })
              }
              required
            />
          </Field>
          <Field
            label={t('account.password.new')}
            isRequired
            helper={t('account.password.helper')}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, newPassword: event.target.value })
              }
              required
            />
          </Field>
          <Field label={t('account.password.confirm')} isRequired>
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })
              }
              required
            />
          </Field>
          <Button
            type="submit"
            colorScheme="brand"
            alignSelf="flex-start"
            isLoading={changingPassword}
          >
            {t('account.password.submit')}
          </Button>
        </Stack>
      </form>
    </SectionCard>
  );
}
