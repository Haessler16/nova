'use client';

import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('rooms.lease.title')}
      </Text>
      {room.lease !== null ? (
        <Stack spacing={2}>
          <Text fontSize="sm">
            {t('rooms.lease.selectedBy', {
              name: room.lease.ownerDisplayName,
              date: formatDateTime(room.lease.expiresAt),
            })}
          </Text>
          {room.lease.ownerUserId === actorId ? (
            <HStack>
              <Button
                size="sm"
                variant="outline"
                isLoading={leases.busy}
                onClick={() => void leases.renew()}
              >
                {t('rooms.lease.renew')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isLoading={leases.busy}
                onClick={() => void leases.release()}
              >
                {t('rooms.lease.release')}
              </Button>
            </HStack>
          ) : (
            <Stack spacing={2}>
              {leases.forceOpen ? (
                <>
                  <Input
                    size="sm"
                    placeholder={t('rooms.lease.forceReasonPlaceholder')}
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
                      {t('rooms.lease.confirmForce')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={leases.busy}
                      onClick={leases.cancelForce}
                    >
                      {t('rooms.lease.cancel')}
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
                  {t('rooms.lease.forceRelease')}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Text fontSize="sm" color="textSecondary">
            {t('rooms.lease.free')}
          </Text>
          <Button
            size="sm"
            alignSelf="flex-start"
            variant="outline"
            isLoading={leases.busy}
            onClick={() => void leases.acquire()}
          >
            {t('rooms.lease.acquire')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
