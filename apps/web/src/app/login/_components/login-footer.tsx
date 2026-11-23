'use client';

import { Divider, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { DEMO_PASSWORD } from '@/lib/demo';
import { useI18n } from '@/lib/i18n';

export function LoginFooter({ authMode }: { authMode: string }) {
  const { t } = useI18n();

  return (
    <>
      <Divider my={5} />
      <Stack spacing={1} fontSize="xs" color="gray.500" textAlign="center">
        <Text>{t('login.footer.auth')}</Text>
        {authMode === 'local-session' && (
          <Text>
            {t('login.footer.demo', {
              email: 'admin@demo.nova.local',
              password: DEMO_PASSWORD,
            })}
          </Text>
        )}
        <Link as={NextLink} href="/dashboard" color="brand.600">
          {t('login.footer.dashboard')}
        </Link>
      </Stack>
    </>
  );
}
