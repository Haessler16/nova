'use client';

import { Box, Button, Stack, Text } from '@chakra-ui/react';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/demo';
import { useI18n } from '@/lib/i18n';
import type { LoginFlow } from '../_hooks/use-login-flow';

export function LoginDevUsers({ flow }: { flow: LoginFlow }) {
  const { t } = useI18n();

  return (
    <Stack spacing={2}>
      {DEMO_USERS.map((user) => (
        <Button
          key={user.id}
          variant="outline"
          justifyContent="flex-start"
          height="auto"
          py={2}
          onClick={() => void flow.handleDevLogin(user.id)}
          isDisabled={flow.busy}
        >
          <Box textAlign="left">
            <Text fontSize="sm" fontWeight="semibold">
              {user.name}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {user.email} · {user.role}
            </Text>
          </Box>
        </Button>
      ))}
      <Text fontSize="xs" color="gray.500" mt={2}>
        {t('login.dev.hint', { password: DEMO_PASSWORD })}
      </Text>
    </Stack>
  );
}
