'use client';

import { Box, Button, Divider, HStack, IconButton, SimpleGrid, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/** Monday-first short weekday labels, derived from the active locale. */
function weekdayLabels(intlLocale: string): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'short',
    timeZone: 'UTC',
  });
  // 2024-01-01 is a Monday; the grid is Monday-first.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(Date.UTC(2024, 0, 1 + index, 12))).replace(/\.$/, ''),
  );
}

interface MonthView {
  year: number;
  month: number;
}

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

export function DateCalendar({
  value,
  today,
  min,
  max,
  isOpen,
  isClearable,
  onSelect,
  onClear,
}: {
  value: string;
  today: string;
  min?: string;
  max?: string;
  isOpen: boolean;
  isClearable: boolean;
  onSelect: (iso: string) => void;
  onClear: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [intlLocale],
  );
  const [view, setView] = useState<MonthView>(() =>
    monthOf(parseCalendar(value !== '' ? value : today)),
  );

  useEffect(() => {
    if (isOpen) {
      setView(monthOf(parseCalendar(value !== '' ? value : today)));
    }
  }, [isOpen, value, today]);

  const monthLabel = capitalize(
    monthFormatter.format(new Date(Date.UTC(view.year, view.month, 1, 12))),
  );
  const previousMonthLastDay = toIso(new Date(Date.UTC(view.year, view.month, 0, 12)));
  const nextMonthFirstDay = toIso(new Date(Date.UTC(view.year, view.month + 1, 1, 12)));
  const canGoPrevious = min === undefined || previousMonthLastDay >= min;
  const canGoNext = max === undefined || nextMonthFirstDay <= max;
  const todayDisabled = isOutOfRange(today, min, max);

  function shiftMonth(delta: number): void {
    const next = new Date(Date.UTC(view.year, view.month + delta, 1, 12));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  return (
    <>
      <HStack justify="space-between" mb={3}>
        <IconButton
          type="button"
          aria-label={t('dateField.previousMonth')}
          icon={<ChevronLeftIcon boxSize={4} />}
          size="xs"
          variant="ghost"
          color="gray.600"
          isDisabled={!canGoPrevious}
          onClick={() => shiftMonth(-1)}
        />
        <Text fontSize="sm" fontWeight="semibold">
          {monthLabel}
        </Text>
        <IconButton
          type="button"
          aria-label={t('dateField.nextMonth')}
          icon={<ChevronRightIcon boxSize={4} />}
          size="xs"
          variant="ghost"
          color="gray.600"
          isDisabled={!canGoNext}
          onClick={() => shiftMonth(1)}
        />
      </HStack>

      <MonthGrid view={view} value={value} today={today} min={min} max={max} onSelect={onSelect} />

      <Divider my={3} />

      <HStack justify="space-between">
        {isClearable ? (
          <Button type="button" size="xs" variant="ghost" color="gray.500" onClick={onClear}>
            {t('dateField.clear')}
          </Button>
        ) : (
          <Box />
        )}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          colorScheme="brand"
          isDisabled={todayDisabled}
          onClick={() => onSelect(today)}
        >
          {t('dateField.today')}
        </Button>
      </HStack>
    </>
  );
}

function MonthGrid({
  view,
  value,
  today,
  min,
  max,
  onSelect,
}: {
  view: MonthView;
  value: string;
  today: string;
  min?: string;
  max?: string;
  onSelect: (iso: string) => void;
}) {
  const { t, intlLocale } = useI18n();
  const cells = useMemo(() => buildMonthCells(view), [view]);
  const weekdays = useMemo(() => weekdayLabels(intlLocale), [intlLocale]);
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [intlLocale],
  );

  return (
    <>
      <SimpleGrid columns={7} spacing="1" mb={1}>
        {weekdays.map((weekday) => (
          <Text
            key={weekday}
            textAlign="center"
            fontSize="10px"
            fontWeight="semibold"
            textTransform="uppercase"
            color="gray.400"
          >
            {weekday}
          </Text>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={7} spacing="1">
        {cells.map((cell) => {
          const selected = cell.iso === value;
          const isToday = cell.iso === today;
          const disabled = isOutOfRange(cell.iso, min, max);
          return (
            <Button
              key={cell.iso}
              type="button"
              variant="ghost"
              size="sm"
              h="34px"
              minW="0"
              w="full"
              p="0"
              borderRadius="full"
              fontSize="sm"
              fontWeight={selected ? 'semibold' : 'normal'}
              color={
                selected ? 'white' : disabled ? 'gray.400' : cell.inMonth ? 'gray.400' : 'gray.800'
              }
              bg={selected ? 'brand.800' : isToday ? 'brand.700' : undefined}
              borderWidth={isToday && !selected ? '1px' : undefined}
              borderColor="brand.400"
              isDisabled={disabled}
              aria-label={capitalize(dayFormatter.format(parseCalendar(cell.iso)))}
              aria-pressed={selected}
              _hover={
                disabled
                  ? undefined
                  : {
                      bg: selected ? 'brand.700' : 'brand.50',
                      color: selected ? 'white' : 'brand.700',
                    }
              }
              _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
              onClick={() => onSelect(cell.iso)}
            >
              {cell.day}
            </Button>
          );
        })}
      </SimpleGrid>
    </>
  );
}

function monthOf(date: Date): MonthView {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function buildMonthCells(view: MonthView): DayCell[] {
  const firstDay = new Date(Date.UTC(view.year, view.month, 1, 12));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(1 - mondayOffset + index);
    return {
      iso: toIso(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === view.month,
    };
  });
}

function parseCalendar(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return new Date(Date.UTC(1970, 0, 1, 12));
  }
  return new Date(
    Date.UTC(Number(match[1] ?? 1970), Number(match[2] ?? 1) - 1, Number(match[3] ?? 1), 12),
  );
}

function toIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isOutOfRange(value: string, min: string | undefined, max: string | undefined): boolean {
  return (min !== undefined && value < min) || (max !== undefined && value > max);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
