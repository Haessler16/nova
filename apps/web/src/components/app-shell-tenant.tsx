'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Avatar,
  Box,
  HStack,
  IconButton,
  Select,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { LogoutIcon } from './icons';

export function TenantSelector() {
  const {
    organizations,
    organizationId,
    properties,
    propertyId,
    selectOrganization,
    selectProperty,
  } = useSession();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();
  const { t } = useI18n();

  async function handleOrganization(value: string): Promise<void> {
    setSwitching(true);
    setError(null);
    try {
      await selectOrganization(value);
    } catch (cause) {
      setError(cause);
      toast({
        title: t('shell.tenant.switchError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSwitching(false);
    }
  }

  const fieldProps = {
    size: 'sm' as const,
    bg: 'whiteAlpha.100',
    borderColor: 'whiteAlpha.200',
    color: 'white',
    borderRadius: 'lg',
    _hover: { borderColor: 'whiteAlpha.300' },
    _focusVisible: {
      borderColor: 'brand.300',
      boxShadow: '0 0 0 1px #79C7F1',
    },
    sx: { option: { color: '#172B4D', bg: '#FFFFFF' } },
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Text
          fontSize="10px"
          fontWeight="bold"
          color="whiteAlpha.500"
          textTransform="uppercase"
          letterSpacing="0.14em"
          mb={1.5}
        >
          {t('shell.tenant.organization')}
        </Text>
        <Select
          {...fieldProps}
          aria-label={t('shell.tenant.organization')}
          value={organizationId ?? ''}
          onChange={(event) => void handleOrganization(event.target.value)}
          isDisabled={switching || organizations.length === 0}
        >
          {organizations.length === 0 && (
            <option value="">{t('shell.tenant.noOrganizations')}</option>
          )}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </Select>
      </Box>
      <Box>
        <Text
          fontSize="10px"
          fontWeight="bold"
          color="whiteAlpha.500"
          textTransform="uppercase"
          letterSpacing="0.14em"
          mb={1.5}
        >
          {t('shell.tenant.property')}
        </Text>
        <Select
          {...fieldProps}
          aria-label={t('shell.tenant.property')}
          value={propertyId ?? ''}
          onChange={(event) => selectProperty(event.target.value)}
          isDisabled={switching || properties.length === 0}
        >
          {properties.length === 0 && <option value="">{t('shell.tenant.noProperties')}</option>}
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name} · {property.code}
            </option>
          ))}
        </Select>
      </Box>
      {switching && (
        <HStack spacing={2} color="whiteAlpha.700">
          <Spinner size="xs" color="brand.300" />
          <Text fontSize="xs">{t('shell.tenant.switching')}</Text>
        </HStack>
      )}
      {error !== null && (
        <Alert status="error" borderRadius="lg" py={1} bg="danger.900" color="white">
          <AlertIcon boxSize={3} color="danger.200" />
          <AlertDescription fontSize="xs">{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
    </Stack>
  );
}

export function UserCard({ onLogout, loggingOut }: { onLogout: () => void; loggingOut: boolean }) {
  const { actor, organization, property } = useSession();
  const { t } = useI18n();

  return (
    <HStack spacing={3} align="center">
      <Avatar size="sm" name={actor?.name} bg="mint.400" color="sidebar" fontWeight="bold" />
      <Box flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="semibold" color="white" noOfLines={1}>
          {actor?.name}
        </Text>
        <Text fontSize="xs" color="whiteAlpha.600" noOfLines={1}>
          {organization?.role?.name ?? 'Staff'} · {property?.code ?? t('shell.user.noProperty')}
        </Text>
      </Box>
      <IconButton
        aria-label={t('shell.user.logout')}
        icon={<LogoutIcon boxSize={4} />}
        size="sm"
        variant="ghost"
        color="whiteAlpha.700"
        isLoading={loggingOut}
        onClick={onLogout}
        _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
        _focusVisible={{ boxShadow: '0 0 0 2px #57B3EA' }}
      />
    </HStack>
  );
}
