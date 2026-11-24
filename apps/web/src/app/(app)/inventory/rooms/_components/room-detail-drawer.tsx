'use client';

import {
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { Room } from '@/lib/types';
import type { RoomBlocks } from '../_hooks/use-room-blocks';
import type { RoomDetail } from '../_hooks/use-room-detail';
import type { RoomHousekeeping } from '../_hooks/use-room-housekeeping';
import type { RoomIncidents } from '../_hooks/use-room-incidents';
import type { RoomLeases } from '../_hooks/use-room-leases';
import { RoomBlocksSection } from './room-blocks-section';
import { RoomDetailOverview } from './room-detail-overview';
import { RoomHistorySection } from './room-history-section';
import { RoomHousekeepingSection } from './room-housekeeping-section';
import { RoomIncidentForm } from './room-incident-form';
import { RoomLeaseSection } from './room-lease-section';

export function RoomDetailDrawer({
  isOpen,
  onClose,
  room,
  detail,
  housekeeping,
  blocks,
  incidents,
  leases,
  actorId,
}: {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  detail: RoomDetail['detail'];
  housekeeping: RoomHousekeeping;
  blocks: RoomBlocks;
  incidents: RoomIncidents;
  leases: RoomLeases;
  actorId: string | undefined;
}) {
  const { t } = useI18n();

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          {t('rooms.drawer.title', { number: room?.number ?? '' })}
          {room !== null && (
            <Text fontSize="sm" fontWeight="normal" color="textSecondary">
              {room.roomType.name} · {room.attributes.join(' · ') || t('rooms.drawer.noAttributes')}
            </Text>
          )}
        </DrawerHeader>
        <DrawerBody pb={10}>
          {room !== null && (
            <Stack spacing={6}>
              <RoomDetailOverview room={room} />
              <RoomLeaseSection room={room} actorId={actorId} leases={leases} />
              <RoomIncidentForm incidents={incidents} />
              <RoomHousekeepingSection room={room} housekeeping={housekeeping} />
              <Divider />
              <RoomBlocksSection detail={detail} blocks={blocks} />
              <Divider />
              <RoomHistorySection detail={detail} />
            </Stack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
