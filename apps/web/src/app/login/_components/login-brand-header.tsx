'use client';

import { Badge, Box, HStack, Heading } from '@chakra-ui/react';

export function LoginBrandHeader() {
  return (
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
  );
}
