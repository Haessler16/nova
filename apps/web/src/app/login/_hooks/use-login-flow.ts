'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';

export function useLoginFlow() {
  const { status, authMode, login, completeMfa, loginDev } = useSession();
  const { t } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  async function handleLocalLogin(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challengeToken !== null) {
        if (!/^\d{6}$/.test(mfaCode)) {
          throw new Error(t('login.error.mfaCode'));
        }
        await completeMfa(challengeToken, mfaCode);
        router.replace('/dashboard');
        return;
      }

      const normalizedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error(t('login.error.email'));
      }
      if (password === '') {
        throw new Error(t('login.error.password'));
      }
      const result = await login(normalizedEmail, password);
      if (result.kind === 'mfa' && result.challengeToken !== undefined) {
        setChallengeToken(result.challengeToken);
        setMfaCode('');
        return;
      }
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function handleDevLogin(userId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await loginDev(userId);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  function backToCredentials(): void {
    setChallengeToken(null);
    setMfaCode('');
    setError(null);
  }

  return {
    status,
    authMode,
    email,
    setEmail,
    password,
    setPassword,
    mfaCode,
    setMfaCode,
    challengeToken,
    busy,
    error,
    handleLocalLogin,
    handleDevLogin,
    backToCredentials,
  };
}

export type LoginFlow = ReturnType<typeof useLoginFlow>;
