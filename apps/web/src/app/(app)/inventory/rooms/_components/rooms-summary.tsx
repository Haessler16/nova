'use client';

import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import type { RoomListSummary } from '@/lib/types';

export function RoomsSummary({ summary }: { summary: RoomListSummary | undefined }) {
  const summaryCards = [
    { label: 'Libres', value: summary?.vacant ?? 0, color: 'mint.600' },
    { label: 'Ocupadas', value: summary?.occupied ?? 0, color: 'brand.600' },
    { label: 'Limpias', value: summary?.clean ?? 0, color: 'sky.600' },
    { label: 'Sucias', value: summary?.dirty ?? 0, color: 'danger.500' },
    { label: 'En limpieza', value: summary?.cleaning ?? 0, color: 'warning.500' },
    { label: 'Inspeccionadas', value: summary?.inspected ?? 0, color: 'mint.600' },
    { label: 'Fuera de orden', value: summary?.outOfOrder ?? 0, color: 'danger.500' },
    { label: 'Fuera de servicio', value: summary?.outOfService ?? 0, color: 'warning.500' },
  ];

  return (
    <>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
        {summaryCards.map((card) => (
          <Box key={card.label} borderWidth="1px" borderRadius="md" px={3} py={2}>
            <Text fontSize="xs" color="textSecondary">
              {card.label}
            </Text>
            <Text fontSize="xl" fontWeight="semibold" color={card.color}>
              {card.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
      <Text fontSize="xs" color="textSecondary" mb={3}>
        {summary?.totalRooms ?? 0} habitaciones activas en la propiedad. Los contadores no dependen
        de los filtros.
      </Text>
    </>
  );
}
