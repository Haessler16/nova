'use client';

import { Button, HStack, Input, Select, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';

export function GuestsSearchBar({
  searchInput,
  onSearchInputChange,
  onSearch,
  status,
  onStatusChange,
  onClear,
  count,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClear: () => void;
  count: number;
}) {
  const { t } = useI18n();

  return (
    <HStack wrap="wrap" spacing={2} mb={4}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <HStack>
          <Input
            size="sm"
            width="260px"
            placeholder={t('guests.searchPlaceholder')}
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
          <Button size="sm" type="submit" variant="outline">
            {t('guests.search')}
          </Button>
        </HStack>
      </form>
      <Select
        size="sm"
        width="170px"
        aria-label={t('guests.statusLabel')}
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        <option value="">{t('guests.status.all')}</option>
        <option value="ACTIVE">{t('guests.status.active')}</option>
        <option value="DISABLED">{t('guests.status.disabled')}</option>
      </Select>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {t('guests.clear')}
      </Button>
      <Text fontSize="xs" color="textSecondary" ml="auto">
        {t('guests.count', { count })}
      </Text>
    </HStack>
  );
}
