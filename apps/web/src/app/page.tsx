'use client';

import {
  Badge,
  Box,
  Code,
  Container,
  Divider,
  Heading,
  List,
  ListItem,
  Stack,
  Text,
} from '@chakra-ui/react';
import { HealthStatus } from '@/components/health-status';

export default function HomePage() {
  return (
    <Container maxW="container.md" py={12}>
      <Stack spacing={6}>
        <Box>
          <Badge colorScheme="purple" mb={3}>
            Phase 1 — Foundation
          </Badge>
          <Heading as="h1" size="2xl" mb={3}>
            NOVA PMS
          </Heading>
          <Text color="gray.600">
            Base ejecutable del PMS hotelero multi-tenant. Esta entrega incluye organización,
            propiedades, usuarios, membresías, roles/permisos, contexto tenant en servidor,
            auditoría append-only y health checks.
          </Text>
        </Box>

        <HealthStatus />

        <Box>
          <Heading size="md" mb={2}>
            Autenticación de desarrollo
          </Heading>
          <Text mb={2} fontSize="sm" color="gray.600">
            No existe proveedor de identidad de producción todavía. La API solo acepta
            <Code mx={1}>X-Dev-User-Id</Code>
            fuera de producción y valida la membresía contra PostgreSQL.
          </Text>
          <Code display="block" whiteSpace="pre-wrap" p={3} borderRadius="md">
            {`curl http://localhost:3001/api/v1/me \\\n  -H "X-Dev-User-Id: 00000000-0000-4000-8000-000000000011"`}
          </Code>
        </Box>

        <Divider />

        <Box>
          <Heading size="md" mb={2}>
            Siguientes pasos
          </Heading>
          <List spacing={1} fontSize="sm" color="gray.600">
            <ListItem>1. Configurar inventario y estados de habitación (Phase 2).</ListItem>
            <ListItem>2. Implementar huéspedes y reservas con concurrencia (Phase 3).</ListItem>
            <ListItem>
              3. Reemplazar auth de desarrollo por proveedor real antes de producción.
            </ListItem>
          </List>
        </Box>
      </Stack>
    </Container>
  );
}
