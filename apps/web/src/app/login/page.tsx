'use client';

import { Box, Center, Spinner } from '@chakra-ui/react';
import { LoginBrandHeader } from './_components/login-brand-header';
import { LoginCard } from './_components/login-card';
import { LoginFooter } from './_components/login-footer';
import { useLoginFlow } from './_hooks/use-login-flow';

export default function LoginPage() {
  const flow = useLoginFlow();

  if (flow.status === 'loading' || flow.authMode === null) {
    return (
      <Center minH="100vh">
        <Spinner />
      </Center>
    );
  }

  return (
    <Center minH="100vh" bg="canvas" px={4} py={10}>
      <Box w="100%" maxW="480px">
        <LoginBrandHeader />
        <LoginCard flow={flow} />
        <LoginFooter authMode={flow.authMode} />
      </Box>
    </Center>
  );
}
