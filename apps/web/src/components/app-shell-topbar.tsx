'use client';

import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import { ALL_NAV_ITEMS } from './app-shell-nav';
import { ConnectionStatus } from './connection-status';
import { AccountIcon, ChevronDownIcon, LogoutIcon, MenuIcon } from './icons';

export function Topbar({
  onOpenNavigation,
  onLogout,
  loggingOut,
}: {
  onOpenNavigation: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const { actor, organization } = useSession();
  const { t } = useI18n();
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
          aria-label={t('shell.menu.openNavigation')}
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
            {current === null ? 'NOVA PMS' : t(current.titleKey)}
          </Text>
          <Text fontSize="sm" fontWeight="semibold" noOfLines={1} color="textPrimary">
            {current === null ? t('shell.nav.dashboard') : t(current.labelKey)}
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
              {t('shell.nav.account')}
            </MenuItem>
            <MenuItem
              icon={<LogoutIcon boxSize={4} />}
              onClick={onLogout}
              isDisabled={loggingOut}
              color="textPrimary"
              _hover={{ bg: 'canvasAlt' }}
            >
              {t('shell.user.logout')}
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
}
