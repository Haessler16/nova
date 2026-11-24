'use client';

import { Box, Button, HStack, Input, Select, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { RoomBlocks } from '../_hooks/use-room-blocks';

export function RoomBlockForm({ blocks }: { blocks: RoomBlocks }) {
  const { t } = useI18n();

  return (
    <Box as="form" onSubmit={(event) => void blocks.create(event)} borderTopWidth="1px" pt={3}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        {t('rooms.blocks.new')}
      </Text>
      <Stack spacing={3}>
        <Select
          size="sm"
          value={blocks.form.type}
          onChange={(event) => blocks.setForm({ ...blocks.form, type: event.target.value })}
        >
          <option value="OUT_OF_ORDER">{t('rooms.blocks.typeOutOfOrder')}</option>
          <option value="OUT_OF_SERVICE">{t('rooms.blocks.typeOutOfService')}</option>
        </Select>
        <Input
          size="sm"
          placeholder={t('rooms.blocks.reasonPlaceholder')}
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
              {t('rooms.blocks.start')}
            </Text>
            <Input
              size="sm"
              type="datetime-local"
              value={blocks.form.startsAt}
              onChange={(event) => blocks.setForm({ ...blocks.form, startsAt: event.target.value })}
              required
            />
          </Box>
          <Box flex="1">
            <Text fontSize="xs" color="textSecondary" mb={1}>
              {t('rooms.blocks.end')}
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
          {t('rooms.blocks.create')}
        </Button>
      </Stack>
    </Box>
  );
}
