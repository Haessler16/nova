'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Divider,
  Heading,
  HStack,
  Input,
  Link,
  PinInput,
  PinInputField,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { errorMessage } from '@/lib/api';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/demo';
import { ErrorAlert } from '@/components/ui';

export default function LoginPage() {
  const { status, authMode, login, completeMfa, loginDev } = useSession();
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
          throw new Error('Ingresá el código de 6 dígitos de tu autenticador.');
        }
        await completeMfa(challengeToken, mfaCode);
        router.replace('/dashboard');
        return;
      }

      const result = await login(email.trim(), password);
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

  if (status === 'loading' || authMode === null) {
    return (
      <Center minH="100vh">
        <Spinner />
      </Center>
    );
  }

  return (
    <Center minH="100vh" bg="canvas" px={4} py={10}>
      <Box w="100%" maxW="480px">
        <HStack spacing={3} mb={6} justify="center">
          <Box
            bgGradient="linear(to-br, brand.400, mint.400)"
            color="sidebar"
            borderRadius="xl"
            boxSize="40px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="800"
            fontSize="lg"
          >
            N
          </Box>
          <Heading size="md" letterSpacing="0.06em">
            NOVA PMS
          </Heading>
          <Badge colorScheme="mint">Hotel Management</Badge>
        </HStack>

        <Box
          bg="surface"
          borderWidth="1px"
          borderColor="line"
          borderRadius="2xl"
          p={{ base: 5, md: 7 }}
          boxShadow="card"
        >
          <Heading size="md" mb={1}>
            Iniciar sesión
          </Heading>
          <Text fontSize="sm" color="gray.600" mb={5}>
            {authMode === 'local-session'
              ? 'Sesión local con usuario y contraseña. La cookie es HttpOnly y las mutaciones requieren CSRF.'
              : authMode === 'dev-header'
                ? 'La API está en modo desarrollo: elegí un usuario sintético del seed.'
                : 'La autenticación está deshabilitada en este entorno.'}
          </Text>

          {error !== null && (
            <Box mb={4}>
              <ErrorAlert error={error} />
            </Box>
          )}

          {authMode === 'local-session' && (
            <form onSubmit={(event) => void handleLocalLogin(event)}>
              <Stack spacing={4}>
                {challengeToken === null ? (
                  <>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Email
                      </Text>
                      <Input
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="admin@demo.nova.local"
                        required
                      />
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Contraseña
                      </Text>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </Box>
                  </>
                ) : (
                  <>
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      <AlertDescription fontSize="sm">
                        Tu cuenta tiene MFA activo. Ingresá el código de 6 dígitos del autenticador.
                      </AlertDescription>
                    </Alert>
                    <HStack justify="center">
                      <PinInput
                        otp
                        size="lg"
                        value={mfaCode}
                        onChange={setMfaCode}
                        aria-label="Código MFA"
                      >
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                      </PinInput>
                    </HStack>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChallengeToken(null);
                        setMfaCode('');
                        setError(null);
                      }}
                    >
                      Volver
                    </Button>
                  </>
                )}
                <Button type="submit" colorScheme="brand" isLoading={busy}>
                  {challengeToken === null ? 'Entrar' : 'Validar código'}
                </Button>
              </Stack>
            </form>
          )}

          {authMode === 'dev-header' && (
            <Stack spacing={2}>
              {DEMO_USERS.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  justifyContent="flex-start"
                  height="auto"
                  py={2}
                  onClick={() => void handleDevLogin(user.id)}
                  isDisabled={busy}
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
                El modo dev-header solo existe fuera de producción. Todos los usuarios sintéticos
                usan la misma contraseña de seed: <Code>{DEMO_PASSWORD}</Code>.
              </Text>
            </Stack>
          )}

          {authMode === 'disabled' && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Configurá <Code>AUTH_MODE=local-session</Code> o <Code>dev-header</Code> en la API
                para habilitar el acceso.
              </AlertDescription>
            </Alert>
          )}
        </Box>

        <Divider my={5} />
        <Stack spacing={1} fontSize="xs" color="gray.500" textAlign="center">
          <Text>
            Autenticación local transitoria: MFA TOTP, recuperación de contraseña y bloqueo por
            intentos están disponibles en la API.
          </Text>
          {authMode === 'local-session' && (
            <Text>
              Usuario demo: <Code>admin@demo.nova.local</Code> · contraseña{' '}
              <Code>{DEMO_PASSWORD}</Code>
            </Text>
          )}
          <Link as={NextLink} href="/dashboard" color="brand.600">
            Ir al panel
          </Link>
        </Stack>
      </Box>
    </Center>
  );
}
