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
import { ConnectionStatus } from './connection-status';
import {
  AccountIcon,
  AdminIcon,
  AuditIcon,
  CalendarIcon,
  CashIcon,
  ChevronDownIcon,
  DashboardIcon,
  FolioIcon,
  FrontDeskIcon,
  GuestsIcon,
  ImportIcon,
  LogoutIcon,
  MenuIcon,
  PilotIcon,
  PropertyIcon,
  ReportsIcon,
  ReservationIcon,
  RoomTypesIcon,
  RoomsIcon,
} from './icons';
import { SectionCard } from './ui';

const NAV_SECTIONS = [
  {
    title: 'Operación',
    items: [
      { href: '/dashboard', label: 'Panel', icon: <DashboardIcon boxSize={4} /> },
      { href: '/front-office', label: 'Front Office', icon: <FrontDeskIcon boxSize={4} /> },
      { href: '/folios', label: 'Folios', icon: <FolioIcon boxSize={4} /> },
      { href: '/reports', label: 'Reportes', icon: <ReportsIcon boxSize={4} /> },
      { href: '/cashier', label: 'Caja y cierre', icon: <CashIcon boxSize={4} /> },
      { href: '/pilot', label: 'Piloto', icon: <PilotIcon boxSize={4} /> },
      { href: '/calendar', label: 'Calendario', icon: <CalendarIcon boxSize={4} /> },
      { href: '/reservations', label: 'Reservas', icon: <ReservationIcon boxSize={4} /> },
      { href: '/guests', label: 'Huéspedes', icon: <GuestsIcon boxSize={4} /> },
      { href: '/imports', label: 'Importaciones', icon: <ImportIcon boxSize={4} /> },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/inventory/rooms', label: 'Habitaciones', icon: <RoomsIcon boxSize={4} /> },
      {
        href: '/inventory/room-types',
        label: 'Tipos de habitación',
        icon: <RoomTypesIcon boxSize={4} />,
      },
      { href: '/settings', label: 'Propiedad', icon: <PropertyIcon boxSize={4} /> },
    ],
  },
  {
    title: 'Seguridad',
    items: [
      { href: '/audit', label: 'Auditoría', icon: <AuditIcon boxSize={4} /> },
      { href: '/admin', label: 'Administración', icon: <AdminIcon boxSize={4} /> },
      { href: '/account', label: 'Mi cuenta', icon: <AccountIcon boxSize={4} /> },
    ],
  },
] as const;

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title })),
);

function NavItem({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      as={NextLink}
      href={href}
      onClick={onClick}
      display="block"
      position="relative"
      px={3}
      py={2.5}
      borderRadius="lg"
      fontSize="sm"
      fontWeight={active ? 'semibold' : 'medium'}
      bg={active ? 'sidebarHover' : 'transparent'}
      color={active ? 'white' : 'whiteAlpha.700'}
      _hover={{ bg: active ? 'sidebarHover' : 'whiteAlpha.100', color: 'white' }}
      _focusVisible={{ boxShadow: '0 0 0 2px #57B3EA', outline: 'none' }}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <Box
          position="absolute"
          left={0}
          top="22%"
          h="56%"
          w="3px"
          borderRadius="full"
          bg="brand.400"
        />
      )}
      <HStack spacing={3}>
        <Box color={active ? 'brand.300' : 'whiteAlpha.600'} display="flex">
          {icon}
        </Box>
        <Text noOfLines={1}>{label}</Text>
      </HStack>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Stack spacing={5} aria-label="Navegación principal">
      {NAV_SECTIONS.map((section) => (
        <Box key={section.title}>
          <Text
            fontSize="10px"
            fontWeight="bold"
            color="whiteAlpha.500"
            textTransform="uppercase"
            letterSpacing="0.16em"
            px={3}
            mb={2}
          >
            {section.title}
          </Text>
          <Stack spacing={0.5}>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
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
    <HStack spacing={3}>
      <Flex
        boxSize="40px"
        flexShrink={0}
        align="center"
        justify="center"
        borderRadius="xl"
        bgGradient="linear(to-br, brand.400, mint.400)"
        color="sidebar"
        fontSize="lg"
        fontWeight="800"
        boxShadow="0 8px 20px rgba(57, 167, 232, 0.25)"
      >
        N
      </Flex>
      <Box minW={0}>
        <Text fontWeight="800" letterSpacing="0.08em" lineHeight="1.1" fontSize="sm">
          NOVA PMS
        </Text>
        <Text
          fontSize="10px"
          color="whiteAlpha.600"
          letterSpacing="0.14em"
          textTransform="uppercase"
          mt={1}
        >
          Hotel management
        </Text>
      </Box>
    </HStack>
  );
}

function TenantSelector() {
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
          Organización
        </Text>
        <Select
          {...fieldProps}
          aria-label="Organización"
          value={organizationId ?? ''}
          onChange={(event) => void handleOrganization(event.target.value)}
          isDisabled={switching || organizations.length === 0}
        >
          {organizations.length === 0 && <option value="">Sin organizaciones</option>}
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
          Propiedad activa
        </Text>
        <Select
          {...fieldProps}
          aria-label="Propiedad"
          value={propertyId ?? ''}
          onChange={(event) => selectProperty(event.target.value)}
          isDisabled={switching || properties.length === 0}
        >
          {properties.length === 0 && <option value="">Sin propiedades</option>}
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
          <Text fontSize="xs">Cambiando contexto…</Text>
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

function UserCard({ onLogout, loggingOut }: { onLogout: () => void; loggingOut: boolean }) {
  const { actor, organization, property } = useSession();

  return (
    <HStack spacing={3} align="center">
      <Avatar size="sm" name={actor?.name} bg="mint.400" color="sidebar" fontWeight="bold" />
      <Box flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="semibold" color="white" noOfLines={1}>
          {actor?.name}
        </Text>
        <Text fontSize="xs" color="whiteAlpha.600" noOfLines={1}>
          {organization?.role?.name ?? 'Staff'} · {property?.code ?? 'sin propiedad'}
        </Text>
      </Box>
      <IconButton
        aria-label="Cerrar sesión"
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

function SidebarContent({
  onNavigate,
  onLogout,
  loggingOut,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return (
    <Flex direction="column" h="100%" bg="sidebar" color="white" px={4} py={5}>
      <Brand />
      <Box mt={6}>
        <TenantSelector />
      </Box>
      <Divider borderColor="whiteAlpha.200" my={5} />
      <Box flex="1" overflowY="auto" mx={-1} px={1} pb={4}>
        <Navigation {...(onNavigate !== undefined ? { onNavigate } : {})} />
      </Box>
      <Divider borderColor="whiteAlpha.200" mb={4} />
      <UserCard onLogout={onLogout} loggingOut={loggingOut} />
    </Flex>
  );
}

function Topbar({
  onOpenNavigation,
  onLogout,
  loggingOut,
}: {
  onOpenNavigation: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const { actor, organization } = useSession();
  const pathname = usePathname();
  const current =
    ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    null;

  return (
    <Flex
      as="header"
      bg="canvas"
      borderBottomWidth="1px"
      borderColor="line"
      px={{ base: 4, md: 6, lg: 8 }}
      py={3}
      align="center"
      justify="space-between"
      gap={3}
      position="sticky"
      top={0}
      zIndex={10}
    >
      <HStack spacing={3} minW={0}>
        <IconButton
          aria-label="Abrir navegación"
          icon={<MenuIcon boxSize={5} />}
          onClick={onOpenNavigation}
          variant="outline"
          size="sm"
          color="textSecondary"
          borderColor="line"
          _hover={{ bg: 'canvasAlt', color: 'textPrimary' }}
          display={{ base: 'inline-flex', lg: 'none' }}
        />
        <Box minW={0}>
          <Text fontSize="xs" color="textSecondary" noOfLines={1}>
            {current?.section ?? 'NOVA PMS'}
          </Text>
          <Text fontSize="sm" fontWeight="semibold" noOfLines={1} color="textPrimary">
            {current?.label ?? 'Panel'}
          </Text>
        </Box>
      </HStack>

      <HStack spacing={{ base: 2, md: 4 }}>
        <Box display={{ base: 'none', sm: 'block' }}>
          <ConnectionStatus />
        </Box>
        <Menu placement="bottom-end">
          <MenuButton
            as={Button}
            variant="ghost"
            size="sm"
            px={2}
            borderRadius="full"
            color="textPrimary"
            rightIcon={<ChevronDownIcon boxSize={3.5} color="textSecondary" />}
            _hover={{ bg: 'canvasAlt' }}
          >
            <HStack spacing={2}>
              <Avatar
                size="xs"
                name={actor?.name}
                bg="brand.100"
                color="brand.700"
                fontWeight="bold"
              />
              <Box display={{ base: 'none', md: 'block' }} textAlign="left">
                <Text fontSize="sm" fontWeight="semibold" lineHeight="1.2" color="textPrimary">
                  {actor?.name}
                </Text>
                <Text fontSize="10px" color="textSecondary" lineHeight="1.2">
                  {organization?.role?.name ?? 'Staff'}
                </Text>
              </Box>
            </HStack>
          </MenuButton>
          <MenuList fontSize="sm" minW="200px">
            <MenuItem as={NextLink} href="/account" icon={<AccountIcon boxSize={4} />}>
              Mi cuenta
            </MenuItem>
            <MenuItem icon={<LogoutIcon boxSize={4} />} onClick={onLogout} isDisabled={loggingOut} color="textPrimary" _hover={{ bg: 'canvasAlt' }}>
              Cerrar sesión
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useSession();
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
    <>
      <Link
        as={NextLink}
        href="#main-content"
        position="fixed"
        top={2}
        left={-9999}
        zIndex={2000}
        px={4}
        py={2}
        bg="surface"
        color="brand.700"
        fontWeight="semibold"
        borderRadius="md"
        boxShadow="card"
        _focusVisible={{ left: 2, outline: 'none', boxShadow: 'focus' }}
      >
        Saltar al contenido principal
      </Link>
      <Flex minH="100vh" bg="canvas">
        <Box
          as="aside"
          display={{ base: 'none', lg: 'block' }}
          w="264px"
          flexShrink={0}
          position="sticky"
          top={0}
          h="100vh"
          bg="sidebar"
        >
          <SidebarContent onLogout={() => void handleLogout()} loggingOut={loggingOut} />
        </Box>

        <Box flex="1" minW={0}>
          <Topbar
            onOpenNavigation={drawer.onOpen}
            onLogout={() => void handleLogout()}
            loggingOut={loggingOut}
          />
          <Box
            as="main"
            id="main-content"
            tabIndex={-1}
            px={{ base: 4, md: 6, lg: 8 }}
            py={{ base: 5, md: 7 }}
            maxW="1600px"
            mx="auto"
            w="100%"
          >
            {children}
          </Box>
        </Box>

        <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose} size="xs">
          <DrawerOverlay />
          <DrawerContent bg="sidebar" maxW="300px">
            <DrawerCloseButton
              color="white"
              top={5}
              right={4}
              _hover={{ bg: 'sidebarHover', color: 'white' }}
            />
            <DrawerBody p={0}>
              <SidebarContent
                onNavigate={drawer.onClose}
                onLogout={() => {
                  drawer.onClose();
                  void handleLogout();
                }}
                loggingOut={loggingOut}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Flex>
    </>
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
      <Center minH="100vh" bg="canvas">
        <Spinner />
      </Center>
    );
  }

  if (organizationId === null) {
    return (
      <Center minH="100vh" px={4} bg="canvas">
        <SectionCard maxW="lg" textAlign="center">
          <Text fontWeight="semibold" mb={2}>
            Tu usuario no tiene una organización activa
          </Text>
          <Text fontSize="sm" color="textSecondary">
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
        <Text fontSize="sm" color="textSecondary">
          {properties.length === 0
            ? 'Tu rol no tiene acceso a ninguna propiedad activa en esta organización.'
            : 'Elegí una propiedad en el selector de la barra lateral para continuar.'}
        </Text>
      </SectionCard>
    );
  }

  return <>{children}</>;
}
