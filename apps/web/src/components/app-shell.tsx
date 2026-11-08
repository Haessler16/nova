'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/context/session';
import { errorMessage } from '@/lib/api';
import { initials } from '@/lib/format';
import { SectionCard } from './ui';

const NAV_SECTIONS = [
  {
    title: 'Operación',
    items: [
      { href: '/dashboard', label: 'Panel' },
      { href: '/reservations', label: 'Reservas' },
      { href: '/guests', label: 'Huéspedes' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/inventory/rooms', label: 'Habitaciones' },
      { href: '/inventory/room-types', label: 'Tipos de habitación' },
      { href: '/settings', label: 'Propiedad' },
    ],
  },
  {
    title: 'Seguridad',
    items: [
      { href: '/audit', label: 'Auditoría' },
      { href: '/admin', label: 'Administración' },
      { href: '/account', label: 'Mi cuenta' },
    ],
  },
] as const;

function NavItem({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      as={NextLink}
      href={href}
      onClick={onClick}
      display="block"
      px={3}
      py={2}
      borderRadius="md"
      fontSize="sm"
      fontWeight={active ? 'semibold' : 'normal'}
      bg={active ? 'purple.50' : 'transparent'}
      color={active ? 'purple.700' : 'gray.700'}
      _hover={{ bg: active ? 'purple.50' : 'gray.100' }}
    >
      {label}
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Stack spacing={5}>
      {NAV_SECTIONS.map((section) => (
        <Box key={section.title}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="gray.500"
            textTransform="uppercase"
            letterSpacing="wide"
            px={3}
            mb={1}
          >
            {section.title}
          </Text>
          <Stack spacing={0.5}>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function Brand() {
  return (
    <HStack spacing={2}>
      <Box
        bg="purple.600"
        color="white"
        borderRadius="md"
        px={2}
        py={1}
        fontSize="sm"
        fontWeight="bold"
      >
        N
      </Box>
      <Box>
        <Text fontWeight="bold" lineHeight="1">
          NOVA PMS
        </Text>
        <Text fontSize="xs" color="gray.500">
          Operaciones hoteleras
        </Text>
      </Box>
    </HStack>
  );
}

function SessionSelectors() {
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

  async function handleOrganization(value: string): Promise<void> {
    setSwitching(true);
    setError(null);
    try {
      await selectOrganization(value);
    } catch (cause) {
      setError(cause);
      toast({
        title: 'No se pudo cambiar de organización',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Stack spacing={1} minW={{ base: '100%', md: '420px' }}>
      <HStack spacing={2} w="100%">
        <Select
          size="sm"
          aria-label="Organización"
          value={organizationId ?? ''}
          onChange={(event) => void handleOrganization(event.target.value)}
          isDisabled={switching || organizations.length === 0}
          bg="white"
        >
          {organizations.length === 0 && <option value="">Sin organizaciones</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          aria-label="Propiedad"
          value={propertyId ?? ''}
          onChange={(event) => selectProperty(event.target.value)}
          isDisabled={switching || properties.length === 0}
          bg="white"
        >
          {properties.length === 0 && <option value="">Sin propiedades</option>}
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name} · {property.code}
            </option>
          ))}
        </Select>
        {switching && <Spinner size="sm" />}
      </HStack>
      {error !== null && (
        <Alert status="error" borderRadius="md" py={1}>
          <AlertIcon boxSize={3} />
          <AlertDescription fontSize="xs">{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
    </Stack>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { actor, organization, property, logout } = useSession();
  const router = useRouter();
  const drawer = useDisclosure();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      <Box
        as="aside"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        w="240px"
        borderRightWidth="1px"
        borderColor="gray.200"
        bg="white"
        px={4}
        py={5}
        position="sticky"
        top={0}
        h="100vh"
      >
        <Brand />
        <Divider my={5} />
        <Box flex="1" overflowY="auto">
          <Navigation />
        </Box>
        <Divider my={4} />
        <Stack spacing={1} fontSize="xs" color="gray.600">
          <Text fontWeight="semibold">{actor?.name}</Text>
          <Text noOfLines={1}>{actor?.email}</Text>
          {organization !== null && (
            <Text>
              Rol: {organization.role?.name ?? 'Staff'} · {property?.code ?? 'sin propiedad'}
            </Text>
          )}
          <Button
            size="xs"
            variant="outline"
            mt={2}
            onClick={() => void handleLogout()}
            isLoading={loggingOut}
          >
            Cerrar sesión
          </Button>
        </Stack>
      </Box>

      <Box flex="1" minW={0}>
        <Flex
          as="header"
          bg="white"
          borderBottomWidth="1px"
          borderColor="gray.200"
          px={{ base: 4, md: 6 }}
          py={3}
          align={{ base: 'stretch', md: 'center' }}
          justify="space-between"
          gap={3}
          direction={{ base: 'column', md: 'row' }}
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack spacing={3} display={{ base: 'flex', lg: 'none' }}>
            <Button
              size="sm"
              variant="outline"
              onClick={drawer.onOpen}
              aria-label="Abrir navegación"
            >
              ☰
            </Button>
            <Brand />
          </HStack>

          <SessionSelectors />

          <HStack spacing={2} justify={{ base: 'space-between', md: 'flex-end' }}>
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                size="sm"
                rightIcon={<Text fontSize="xs">▾</Text>}
              >
                <HStack spacing={2}>
                  <Avatar size="xs" name={actor?.name} bg="purple.600" color="white" />
                  <Text fontSize="sm" display={{ base: 'none', sm: 'block' }}>
                    {actor?.name}
                  </Text>
                </HStack>
              </MenuButton>
              <MenuList fontSize="sm">
                <MenuItem as={NextLink} href="/account">
                  Mi cuenta
                </MenuItem>
                <MenuItem onClick={() => void handleLogout()}>Cerrar sesión</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Box px={{ base: 4, md: 6 }} py={{ base: 5, md: 7 }} maxW="1600px" mx="auto">
          {children}
        </Box>
      </Box>

      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerBody pt={10}>
            <Navigation onNavigate={drawer.onClose} />
            <Divider my={4} />
            <Button
              size="sm"
              variant="outline"
              width="100%"
              onClick={() => {
                drawer.onClose();
                void handleLogout();
              }}
            >
              Cerrar sesión
            </Button>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { status, organizationId, organizations } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <Center minH="100vh">
        <Spinner />
      </Center>
    );
  }

  if (organizationId === null) {
    return (
      <Center minH="100vh" px={4}>
        <SectionCard maxW="lg" textAlign="center">
          <Text fontWeight="semibold" mb={2}>
            Tu usuario no tiene una organización activa
          </Text>
          <Text fontSize="sm" color="gray.600">
            Pedile a un administrador que cree o reactive tu membresía. Organizaciones detectadas:{' '}
            {organizations.length}.
          </Text>
        </SectionCard>
      </Center>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export function PropertyGate({ children }: { children: ReactNode }) {
  const { propertyId, properties } = useSession();

  if (propertyId === null) {
    return (
      <SectionCard>
        <Text fontWeight="semibold" mb={1}>
          No hay una propiedad seleccionada
        </Text>
        <Text fontSize="sm" color="gray.600">
          {properties.length === 0
            ? 'Tu rol no tiene acceso a ninguna propiedad activa en esta organización.'
            : 'Elegí una propiedad en el selector superior para continuar.'}
        </Text>
      </SectionCard>
    );
  }

  return <>{children}</>;
}
