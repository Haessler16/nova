'use client';

import { Box, Button, HStack, Input, Select, Stack, Text } from '@chakra-ui/react';
import type { RoomBlocks } from '../_hooks/use-room-blocks';

export function RoomBlockForm({ blocks }: { blocks: RoomBlocks }) {
  return (
    <Box as="form" onSubmit={(event) => void blocks.create(event)} borderTopWidth="1px" pt={3}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        Nuevo bloqueo
      </Text>
      <Stack spacing={3}>
        <Select
          size="sm"
          value={blocks.form.type}
          onChange={(event) => blocks.setForm({ ...blocks.form, type: event.target.value })}
        >
          <option value="OUT_OF_ORDER">Fuera de orden</option>
          <option value="OUT_OF_SERVICE">Fuera de servicio</option>
        </Select>
        <Input
          size="sm"
          placeholder="Motivo (3–500)"
          value={blocks.form.reason}
          onChange={(event) => blocks.setForm({ ...blocks.form, reason: event.target.value })}
          isInvalid={blocks.errors.reason !== undefined}
          maxLength={500}
        />
        {blocks.errors.reason !== undefined && (
          <Text fontSize="xs" color="danger.500">
            {blocks.errors.reason}
          </Text>
        )}
        <HStack>
          <Box flex="1">
            <Text fontSize="xs" color="textSecondary" mb={1}>
              Inicio
            </Text>
            <Input
              size="sm"
              type="datetime-local"
              value={blocks.form.startsAt}
              onChange={(event) =>
                blocks.setForm({ ...blocks.form, startsAt: event.target.value })
              }
              required
            />
          </Box>
          <Box flex="1">
            <Text fontSize="xs" color="textSecondary" mb={1}>
              Fin
            </Text>
            <Input
              size="sm"
              type="datetime-local"
              value={blocks.form.endsAt}
              onChange={(event) => blocks.setForm({ ...blocks.form, endsAt: event.target.value })}
              required
            />
          </Box>
        </HStack>
        {(blocks.errors.startsAt !== undefined || blocks.errors.endsAt !== undefined) && (
          <Text fontSize="xs" color="danger.500">
            {blocks.errors.startsAt ?? blocks.errors.endsAt}
          </Text>
        )}
        <Button type="submit" size="sm" colorScheme="brand" isLoading={blocks.saving}>
          Crear bloqueo
        </Button>
      </Stack>
    </Box>
  );
}
