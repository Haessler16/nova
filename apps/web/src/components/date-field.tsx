'use client';

import {
  Button,
  HStack,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { CalendarIcon } from '@/components/icons';
import { formatCalendarDate, todayISO } from '@/lib/format';
import { DateCalendar } from './date-field-calendar';

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

  function selectDate(next: string): void {
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
          bg="white"
          borderRadius="xl"
          aria-label="Calendario"
          borderColor="gray.200"
          boxShadow="xl"
          _focus={{ outline: 'none', boxShadow: 'xl' }}
        >
          <DateCalendar
            value={value}
            today={today}
            {...(min !== undefined ? { min } : {})}
            {...(max !== undefined ? { max } : {})}
            isOpen={isOpen}
            isClearable={isClearable}
            onSelect={selectDate}
            onClear={clear}
          />
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
