'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';

export function AccountIdentityCard() {
  const { actor, authMode, me } = useSession();
  const { t } = useI18n();

  return (
    <SectionCard>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">{t('account.identity')}</Text>
        <Badge colorScheme={authMode === 'local-session' ? 'brand' : 'warning'}>
          {authMode === 'local-session'
            ? t('account.authMode.local')
            : t('account.authMode.devHeader')}
        </Badge>
      </HStack>
      <Stack spacing={2}>
        <KeyValue label={t('account.field.name')} value={actor?.name ?? '—'} />
        <KeyValue label={t('account.field.email')} value={actor?.email ?? '—'} />
        <KeyValue
          label={t('account.field.userId')}
          value={
            <Box as="code" fontSize="xs">
              {actor?.id ?? '—'}
            </Box>
          }
        />
        <KeyValue label={t('account.field.memberships')} value={me?.memberships.length ?? 0} />
      </Stack>
      {authMode !== 'local-session' && (
        <Alert status="info" mt={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription fontSize="xs">{t('account.devHeaderNotice')}</AlertDescription>
        </Alert>
      )}
    </SectionCard>
  );
}
