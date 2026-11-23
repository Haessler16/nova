'use client';

import { Box, Flex, HStack, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import {
  AccountIcon,
  AdminIcon,
  AuditIcon,
  CalendarIcon,
  CashIcon,
  DashboardIcon,
  FolioIcon,
  FrontDeskIcon,
  GuestsIcon,
  ImportIcon,
  PilotIcon,
  PropertyIcon,
  ReportsIcon,
  ReservationIcon,
  RoomTypesIcon,
  RoomsIcon,
} from './icons';

export interface NavEntry {
  href: string;
  labelKey: TranslationKey;
  icon: ReactNode;
}

export const NAV_SECTIONS: Array<{ titleKey: TranslationKey; items: NavEntry[] }> = [
  {
    titleKey: 'shell.nav.operation',
    items: [
      { href: '/dashboard', labelKey: 'shell.nav.dashboard', icon: <DashboardIcon boxSize={4} /> },
      {
        href: '/front-office',
        labelKey: 'shell.nav.frontOffice',
        icon: <FrontDeskIcon boxSize={4} />,
      },
      { href: '/folios', labelKey: 'shell.nav.folios', icon: <FolioIcon boxSize={4} /> },
      { href: '/catalog', labelKey: 'shell.nav.catalog', icon: <FolioIcon boxSize={4} /> },
      { href: '/reports', labelKey: 'shell.nav.reports', icon: <ReportsIcon boxSize={4} /> },
      { href: '/cashier', labelKey: 'shell.nav.cashier', icon: <CashIcon boxSize={4} /> },
      { href: '/pilot', labelKey: 'shell.nav.pilot', icon: <PilotIcon boxSize={4} /> },
      { href: '/calendar', labelKey: 'shell.nav.calendar', icon: <CalendarIcon boxSize={4} /> },
      {
        href: '/reservations',
        labelKey: 'shell.nav.reservations',
        icon: <ReservationIcon boxSize={4} />,
      },
      { href: '/guests', labelKey: 'shell.nav.guests', icon: <GuestsIcon boxSize={4} /> },
      { href: '/imports', labelKey: 'shell.nav.imports', icon: <ImportIcon boxSize={4} /> },
    ],
  },
  {
    titleKey: 'shell.nav.configuration',
    items: [
      { href: '/inventory/rooms', labelKey: 'shell.nav.rooms', icon: <RoomsIcon boxSize={4} /> },
      {
        href: '/inventory/room-types',
        labelKey: 'shell.nav.roomTypes',
        icon: <RoomTypesIcon boxSize={4} />,
      },
      { href: '/settings', labelKey: 'shell.nav.property', icon: <PropertyIcon boxSize={4} /> },
    ],
  },
  {
    titleKey: 'shell.nav.security',
    items: [
      { href: '/audit', labelKey: 'shell.nav.audit', icon: <AuditIcon boxSize={4} /> },
      { href: '/admin', labelKey: 'shell.nav.admin', icon: <AdminIcon boxSize={4} /> },
      { href: '/account', labelKey: 'shell.nav.account', icon: <AccountIcon boxSize={4} /> },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, titleKey: section.titleKey })),
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

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();

  return (
    <Stack spacing={5} aria-label={t('shell.nav.label')}>
      {NAV_SECTIONS.map((section) => (
        <Box key={section.titleKey}>
          <Text
            fontSize="10px"
            fontWeight="bold"
            color="whiteAlpha.500"
            textTransform="uppercase"
            letterSpacing="0.16em"
            px={3}
            mb={2}
          >
            {t(section.titleKey)}
          </Text>
          <Stack spacing={0.5}>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={t(item.labelKey)}
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

export function Brand() {
  const { t } = useI18n();

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
          {t('shell.brand.subtitle')}
        </Text>
      </Box>
    </HStack>
  );
}
