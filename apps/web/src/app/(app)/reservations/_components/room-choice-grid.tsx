'use client';

import { Button, HStack } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { AvailabilityItem } from '@/lib/types';

export function RoomChoiceGrid({
  items,
  value,
  onChange,
  allowUnassigned = false,
  disabled = false,
}: {
  items: AvailabilityItem[];
  value: string;
  onChange: (roomId: string) => void;
  allowUnassigned?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <HStack wrap="wrap" spacing={2}>
      {allowUnassigned && (
        <Button
          size="sm"
          variant={value === '' ? 'solid' : 'outline'}
          colorScheme={value === '' ? 'brand' : 'gray'}
          onClick={() => onChange('')}
          isDisabled={disabled}
        >
          {t('reservations.unassigned')}
        </Button>
      )}
      {items.map((item) => (
        <Button
          key={item.roomId}
          size="sm"
          variant={value === item.roomId ? 'solid' : 'outline'}
          colorScheme={value === item.roomId ? 'brand' : 'gray'}
          onClick={() => onChange(item.roomId)}
          isDisabled={disabled}
        >
          {t('reservations.roomPrefix', { number: item.number })}
          {item.floor !== null ? t('reservations.floor', { floor: item.floor }) : ''}
        </Button>
      ))}
    </HStack>
  );
}
