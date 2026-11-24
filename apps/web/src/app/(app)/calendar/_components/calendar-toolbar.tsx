'use client';

import { Box, Button, Flex, HStack, Select, Text } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { addDaysISO, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { BAR_COLORS } from '../_lib/calendar-constants';

export function CalendarToolbar({
  startDate,
  onStartDateChange,
  days,
  onDaysChange,
  today,
  assignedCount,
  unassignedCount,
  hasData,
}: {
  startDate: string;
  onStartDateChange: (value: string) => void;
  days: number;
  onDaysChange: (value: number) => void;
  today: string;
  assignedCount: number;
  unassignedCount: number;
  hasData: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <Flex
      px={4}
      py={3}
      gap={3}
      wrap="wrap"
      align="center"
      borderBottomWidth="1px"
      borderColor="gray.200"
    >
      <HStack spacing={1}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStartDateChange(addDaysISO(startDate, -7))}
        >
          {t('calendar.prev7')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStartDateChange(today)}>
          {t('calendar.today')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStartDateChange(addDaysISO(startDate, 7))}
        >
          {t('calendar.next7')}
        </Button>
      </HStack>
      <HStack spacing={2}>
        <Text fontSize="sm" color="gray.600">
          {t('calendar.from')}
        </Text>
        <DateField
          size="sm"
          width="150px"
          value={startDate}
          placeholder={t('calendar.datePlaceholder')}
          ariaLabel={t('calendar.startLabel')}
          onChange={onStartDateChange}
        />
        <Select
          size="sm"
          width="110px"
          aria-label={t('calendar.daysLabel')}
          value={days}
          onChange={(event) => onDaysChange(Number(event.target.value))}
        >
          <option value={7}>{t('calendar.days', { count: 7 })}</option>
          <option value={14}>{t('calendar.days', { count: 14 })}</option>
          <option value={21}>{t('calendar.days', { count: 21 })}</option>
        </Select>
      </HStack>
      <HStack spacing={3} ml="auto" wrap="wrap">
        {(['CONFIRMED', 'CHECKED_IN', 'NO_SHOW'] as const).map((status) => (
          <HStack key={status} spacing={1}>
            <Box boxSize="10px" borderRadius="sm" bg={BAR_COLORS[status]} />
            <Text fontSize="xs" color="gray.600">
              {reservationStatusLabel(locale, status)}
            </Text>
          </HStack>
        ))}
        {hasData && (
          <Text fontSize="xs" color="gray.500">
            {t('calendar.assigned', { count: assignedCount })}
            {unassignedCount > 0 ? t('calendar.unassignedSuffix', { count: unassignedCount }) : ''}
          </Text>
        )}
      </HStack>
    </Flex>
  );
}
