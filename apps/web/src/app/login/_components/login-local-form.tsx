'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  HStack,
  Input,
  PinInput,
  PinInputField,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { LoginFlow } from '../_hooks/use-login-flow';

export function LoginLocalForm({ flow }: { flow: LoginFlow }) {
  const { t } = useI18n();

  return (
    <form onSubmit={(event) => void flow.handleLocalLogin(event)}>
      <Stack spacing={4}>
        {flow.challengeToken === null ? (
          <>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                {t('login.field.email')}
              </Text>
              <Input
                type="email"
                autoComplete="username"
                value={flow.email}
                onChange={(event) => flow.setEmail(event.target.value)}
                placeholder="admin@demo.nova.local"
                required
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                {t('login.field.password')}
              </Text>
              <Input
                type="password"
                autoComplete="current-password"
                value={flow.password}
                onChange={(event) => flow.setPassword(event.target.value)}
                required
              />
            </Box>
          </>
        ) : (
          <>
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">{t('login.mfa.alert')}</AlertDescription>
            </Alert>
            <HStack justify="center">
              <PinInput
                otp
                size="lg"
                value={flow.mfaCode}
                onChange={flow.setMfaCode}
                aria-label={t('login.mfa.aria')}
              >
                <PinInputField />
                <PinInputField />
                <PinInputField />
                <PinInputField />
                <PinInputField />
                <PinInputField />
              </PinInput>
            </HStack>
            <Button variant="ghost" size="sm" onClick={flow.backToCredentials}>
              {t('login.back')}
            </Button>
          </>
        )}
        <Button type="submit" colorScheme="brand" isLoading={flow.busy}>
          {flow.challengeToken === null ? t('login.submit') : t('login.submitMfa')}
        </Button>
      </Stack>
    </form>
  );
}
