'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field, KeyValue, PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage, isApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { SessionSummary } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface MfaSetup {
  secret: string;
  otpauthUri: string;
  issuer: string;
}

function AccountContent() {
  const { actor, authMode, me } = useSession();
  const toast = useToast();

  const sessions = useAsyncData<SessionSummary[]>(
    () => api<SessionSummary[]>('/api/v1/auth/sessions'),
    'account:sessions',
  );

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });

  async function changePassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'La confirmación no coincide', status: 'warning' });
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
      toast({ title: 'Contraseña actualizada', status: 'success' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (cause) {
      toast({
        title: 'No se pudo cambiar la contraseña',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function revokeSession(session: SessionSummary): Promise<void> {
    try {
      await api<void>(`/api/v1/auth/sessions/${session.id}`, { method: 'DELETE' });
      toast({ title: 'Sesión revocada', status: 'success' });
      sessions.reload();
    } catch (cause) {
      toast({ title: 'No se pudo revocar', description: errorMessage(cause), status: 'error' });
    }
  }

  async function startMfa(): Promise<void> {
    setMfaBusy(true);
    try {
      const setup = await api<MfaSetup>('/api/v1/auth/mfa/setup', { method: 'POST' });
      setMfaSetup(setup);
    } catch (cause) {
      toast({
        title: 'No se pudo iniciar MFA',
        description:
          isApiError(cause) && cause.code === 'mfa_already_enabled'
            ? 'MFA ya está activo. Desactivalo antes de enrolar otro autenticador.'
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
      toast({ title: 'MFA activado', status: 'success' });
      setMfaSetup(null);
      setMfaCode('');
    } catch (cause) {
      toast({ title: 'Código inválido', description: errorMessage(cause), status: 'error' });
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa(event: FormEvent): Promise<void> {
    event.preventDefault();
    setMfaBusy(true);
    try {
      await api<void>('/api/v1/auth/mfa/disable', {
        method: 'POST',
        body: { password: disableForm.password, code: disableForm.code },
      });
      toast({ title: 'MFA desactivado', status: 'success' });
      setDisableForm({ password: '', code: '' });
    } catch (cause) {
      toast({
        title: 'No se pudo desactivar MFA',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Mi cuenta"
        description="Identidad, sesiones activas y segundo factor. Las sesiones se validan contra PostgreSQL en cada request."
      />

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
        <Stack spacing={6}>
          <SectionCard>
            <HStack justify="space-between" mb={3}>
              <Text fontWeight="semibold">Identidad</Text>
              <Badge colorScheme={authMode === 'local-session' ? 'purple' : 'orange'}>
                {authMode === 'local-session' ? 'Sesión local' : 'dev-header'}
              </Badge>
            </HStack>
            <Stack spacing={2}>
              <KeyValue label="Nombre" value={actor?.name ?? '—'} />
              <KeyValue label="Email" value={actor?.email ?? '—'} />
              <KeyValue
                label="User ID"
                value={
                  <Box as="code" fontSize="xs">
                    {actor?.id ?? '—'}
                  </Box>
                }
              />
              <KeyValue label="Membresías" value={me?.memberships.length ?? 0} />
            </Stack>
            {authMode !== 'local-session' && (
              <Alert status="info" mt={4} borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="xs">
                  En modo dev-header no hay contraseña ni MFA reales: los endpoints de credenciales
                  operan sobre el usuario elegido, pero el seed no define contraseñas.
                </AlertDescription>
              </Alert>
            )}
          </SectionCard>

          <SectionCard>
            <Text fontWeight="semibold" mb={3}>
              Sesiones activas
            </Text>
            <QueryFeedback
              loading={sessions.loading}
              error={sessions.error}
              onRetry={sessions.reload}
              isEmpty={(sessions.data?.length ?? 0) === 0}
              emptyText="No hay sesiones activas registradas."
            >
              <Stack spacing={2}>
                {sessions.data?.map((session) => (
                  <HStack
                    key={session.id}
                    justify="space-between"
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                    align="flex-start"
                  >
                    <Box>
                      <HStack spacing={2}>
                        {session.current === true && <Badge colorScheme="green">Actual</Badge>}
                        <Text fontSize="xs" color="gray.600">
                          Última actividad {formatDateTime(session.lastSeenAt)}
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="320px">
                        {session.userAgent ?? 'Cliente desconocido'}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Expira {formatDateTime(session.expiresAt)}
                      </Text>
                    </Box>
                    {session.current !== true && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void revokeSession(session)}
                      >
                        Revocar
                      </Button>
                    )}
                  </HStack>
                ))}
              </Stack>
            </QueryFeedback>
            <Text fontSize="xs" color="gray.500" mt={3}>
              Revocar la sesión actual te obliga a iniciar sesión de nuevo.
            </Text>
          </SectionCard>
        </Stack>

        <Stack spacing={6}>
          {authMode === 'local-session' && (
            <>
              <SectionCard>
                <Text fontWeight="semibold" mb={3}>
                  Cambiar contraseña
                </Text>
                <form onSubmit={(event) => void changePassword(event)}>
                  <Stack spacing={3}>
                    <Field label="Contraseña actual" isRequired>
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
                      label="Nueva contraseña"
                      isRequired
                      helper="Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo."
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
                    <Field label="Confirmar nueva contraseña" isRequired>
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
                      colorScheme="purple"
                      alignSelf="flex-start"
                      isLoading={changingPassword}
                    >
                      Actualizar contraseña
                    </Button>
                  </Stack>
                </form>
              </SectionCard>

              <SectionCard>
                <Text fontWeight="semibold" mb={1}>
                  Autenticación en dos pasos (TOTP)
                </Text>
                <Text fontSize="xs" color="gray.600" mb={3}>
                  Enrolá un autenticador. El secreto se muestra una sola vez; guardalo antes de
                  confirmar.
                </Text>

                {mfaSetup === null ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void startMfa()}
                    isLoading={mfaBusy}
                  >
                    Configurar MFA
                  </Button>
                ) : (
                  <Stack spacing={3}>
                    <Alert status="warning" borderRadius="md">
                      <AlertIcon />
                      <AlertDescription fontSize="xs">
                        Secreto TOTP: <Code>{mfaSetup.secret}</Code>
                        <br />
                        URI: <Code wordBreak="break-all">{mfaSetup.otpauthUri}</Code>
                      </AlertDescription>
                    </Alert>
                    <HStack>
                      <Input
                        size="sm"
                        placeholder="Código de 6 dígitos"
                        value={mfaCode}
                        maxLength={6}
                        onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                      />
                      <Button
                        size="sm"
                        colorScheme="purple"
                        onClick={() => void enableMfa()}
                        isLoading={mfaBusy}
                        isDisabled={!/^\d{6}$/.test(mfaCode)}
                      >
                        Activar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMfaSetup(null)}>
                        Cancelar
                      </Button>
                    </HStack>
                  </Stack>
                )}

                <Divider my={4} />
                <form onSubmit={(event) => void disableMfa(event)}>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Desactivar MFA
                  </Text>
                  <Stack spacing={2}>
                    <Input
                      size="sm"
                      type="password"
                      placeholder="Contraseña"
                      value={disableForm.password}
                      onChange={(event) =>
                        setDisableForm({ ...disableForm, password: event.target.value })
                      }
                      required
                    />
                    <HStack>
                      <Input
                        size="sm"
                        placeholder="Código de 6 dígitos"
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
                      <Button type="submit" size="sm" variant="outline" isLoading={mfaBusy}>
                        Desactivar
                      </Button>
                    </HStack>
                  </Stack>
                </form>
              </SectionCard>
            </>
          )}

          <SectionCard>
            <Text fontWeight="semibold" mb={2}>
              Membresías
            </Text>
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Organización</Th>
                    <Th>Rol</Th>
                    <Th>Propiedades</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {me?.memberships.map((membership) => (
                    <Tr key={membership.organization.id}>
                      <Td>{membership.organization.name}</Td>
                      <Td>{membership.role?.name ?? 'Sin rol'}</Td>
                      <Td>{membership.properties.length}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Stack>
      </SimpleGrid>
    </>
  );
}

export default function AccountPage() {
  return <AccountContent />;
}
