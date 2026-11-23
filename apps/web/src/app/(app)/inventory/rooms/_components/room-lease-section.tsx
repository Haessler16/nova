'use client';

import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { formatDateTime } from '@/lib/format';
import type { Room } from '@/lib/types';
import type { RoomLeases } from '../_hooks/use-room-leases';

export function RoomLeaseSection({
  room,
  actorId,
  leases,
}: {
  room: Room;
  actorId: string | undefined;
  leases: RoomLeases;
}) {
  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        Selección temporal
      </Text>
      {room.lease !== null ? (
        <Stack spacing={2}>
          <Text fontSize="sm">
            En selección por <strong>{room.lease.ownerDisplayName}</strong> hasta{' '}
            {formatDateTime(room.lease.expiresAt)}.
          </Text>
          {room.lease.ownerUserId === actorId ? (
            <HStack>
              <Button
                size="sm"
                variant="outline"
                isLoading={leases.busy}
                onClick={() => void leases.renew()}
              >
                Renovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isLoading={leases.busy}
                onClick={() => void leases.release()}
              >
                Liberar
              </Button>
            </HStack>
          ) : (
            <Stack spacing={2}>
              {leases.forceOpen ? (
                <>
                  <Input
                    size="sm"
                    placeholder="Motivo de la liberación"
                    value={leases.forceReason}
                    onChange={(event) => leases.setForceReason(event.target.value)}
                  />
                  <HStack>
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={leases.busy}
                      isDisabled={leases.forceReason.trim() === ''}
                      onClick={() => void leases.forceRelease()}
                    >
                      Confirmar liberación
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={leases.busy}
                      onClick={leases.cancelForce}
                    >
                      Cancelar
                    </Button>
                  </HStack>
                </>
              ) : (
                <Button
                  size="sm"
                  alignSelf="flex-start"
                  variant="ghost"
                  isLoading={leases.busy}
                  onClick={() => leases.setForceOpen(true)}
                >
                  Liberar selección forzada
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Text fontSize="sm" color="textSecondary">
            Nadie está seleccionando esta habitación. La selección expira sola y no reserva la
            habitación.
          </Text>
          <Button
            size="sm"
            alignSelf="flex-start"
            variant="outline"
            isLoading={leases.busy}
            onClick={() => void leases.acquire()}
          >
            Tomar selección
          </Button>
        </Stack>
      )}
    </Box>
  );
}
