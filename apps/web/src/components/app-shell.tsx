'use client';

import {
  Box,
  Center,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Link,
  Spinner,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import { SidebarContent } from './app-shell-sidebar';
import { Topbar } from './app-shell-topbar';
import { SectionCard } from './ui';

function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useSession();
  const { t } = useI18n();
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
        {t('shell.skipToContent')}
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
  const { t } = useI18n();
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
            {t('shell.gate.noOrganization.title')}
          </Text>
          <Text fontSize="sm" color="textSecondary">
            {t('shell.gate.noOrganization.body', { count: organizations.length })}
          </Text>
        </SectionCard>
      </Center>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export function PropertyGate({ children }: { children: ReactNode }) {
  const { propertyId, properties } = useSession();
  const { t } = useI18n();

  if (propertyId === null) {
    return (
      <SectionCard>
        <Text fontWeight="semibold" mb={1}>
          {t('shell.gate.noProperty.title')}
        </Text>
        <Text fontSize="sm" color="textSecondary">
          {properties.length === 0
            ? t('shell.gate.noProperty.noAccess')
            : t('shell.gate.noProperty.select')}
        </Text>
      </SectionCard>
    );
  }

  return <>{children}</>;
}
