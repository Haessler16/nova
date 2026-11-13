'use client';

import {
  Box,
  Button,
  Divider,
  HStack,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Portal,
  SimpleGrid,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { formatCalendarDate, todayISO } from '@/lib/format';

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'] as const;
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

interface MonthView {
  year: number;
  month: number;
}

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

export interface DateFieldProps {
  /** Calendar value in YYYY-MM-DD format. Empty string means no selection. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  min?: string;
  max?: string;
  /** Property calendar day used for the "today" marker. Defaults to the browser's UTC date. */
  today?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  size?: 'sm' | 'md';
  width?: string | number;
}

export function DateField({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  ariaLabel,
  min,
  max,
  today = todayISO(),
  isClearable = false,
  isDisabled = false,
  size = 'sm',
  width,
}: DateFieldProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const fallbackDate = value !== '' ? value : today;
  const [view, setView] = useState<MonthView>(() => monthOf(parseCalendar(fallbackDate)));

  useEffect(() => {
    if (isOpen) {
      setView(monthOf(parseCalendar(value !== '' ? value : today)));
    }
  }, [isOpen, value, today]);

  const cells = useMemo(() => buildMonthCells(view), [view]);
  const monthLabel = capitalize(
    MONTH_FORMATTER.format(new Date(Date.UTC(view.year, view.month, 1, 12))),
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

  function selectDate(next: string): void {
    if (isOutOfRange(next, min, max)) {
      return;
    }
    onChange(next);
    onClose();
  }

  function clear(): void {
    onChange('');
    onClose();
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement="bottom-start"
      isLazy
      returnFocusOnClose
    >
      <PopoverTrigger>
        <Button
          type="button"
          size={size}
          variant="outline"
          width={width ?? '100%'}
          fontWeight="normal"
          color={value === '' ? 'gray.500' : undefined}
          bg="white"
          borderColor="gray.200"
          isDisabled={isDisabled}
          aria-label={ariaLabel ?? placeholder}
          aria-haspopup="dialog"
          _hover={{ borderColor: 'brand.300', bg: 'brand.50' }}
        >
          <HStack as="span" width="full" justify="space-between" spacing={2}>
            <Text as="span" noOfLines={1}>
              {value !== '' ? formatCalendarDate(value) : placeholder}
            </Text>
            <CalendarIcon boxSize={4} color="gray.400" />
          </HStack>
        </Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          width="312px"
          p={3}
          borderRadius="xl"
          aria-label="Calendario"
          borderColor="gray.200"
          boxShadow="xl"
          _focus={{ outline: 'none', boxShadow: 'xl' }}
        >
          <HStack justify="space-between" mb={3}>
            <IconButton
              type="button"
              aria-label="Mes anterior"
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
              aria-label="Mes siguiente"
              icon={<ChevronRightIcon boxSize={4} />}
              size="xs"
              variant="ghost"
              color="gray.600"
              isDisabled={!canGoNext}
              onClick={() => shiftMonth(1)}
            />
          </HStack>

          <SimpleGrid columns={7} spacing="1" mb={1}>
            {WEEKDAYS.map((weekday) => (
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
                    selected
                      ? 'white'
                      : disabled
                        ? 'gray.400'
                        : cell.inMonth
                          ? 'gray.800'
                          : 'gray.400'
                  }
                  bg={selected ? 'brand.600' : isToday ? 'brand.50' : undefined}
                  borderWidth={isToday && !selected ? '1px' : undefined}
                  borderColor="brand.300"
                  isDisabled={disabled}
                  aria-label={capitalize(DAY_FORMATTER.format(parseCalendar(cell.iso)))}
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
                  onClick={() => selectDate(cell.iso)}
                >
                  {cell.day}
                </Button>
              );
            })}
          </SimpleGrid>

          <Divider my={3} />

          <HStack justify="space-between">
            {isClearable ? (
              <Button type="button" size="xs" variant="ghost" color="gray.500" onClick={clear}>
                Limpiar
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
              onClick={() => selectDate(today)}
            >
              Hoy
            </Button>
          </HStack>
        </PopoverContent>
      </Portal>
    </Popover>
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
