'use client';

import { Box, Divider, Flex } from '@chakra-ui/react';
import { Brand, Navigation } from './app-shell-nav';
import { TenantSelector, UserCard } from './app-shell-tenant';

export function SidebarContent({
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
