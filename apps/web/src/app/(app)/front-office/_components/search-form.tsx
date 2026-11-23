'use client';

import {
  Box,
  Button,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { DateField } from '@/components/date-field';
import { Field, SectionCard } from '@/components/ui';
import { RESERVATION_STATUS_COLORS, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationStatus } from '@/lib/types';
import type { SearchFilters } from '../_lib/front-office.types';

export function FrontOfficeSearchForm({
  inputs,
  active,
  loading,
  onChange,
  onSubmit,
  onClear,
}: {
  inputs: SearchFilters;
  active: boolean;
  loading: boolean;
  onChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <SectionCard mb={6}>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          <HStack justify="space-between" wrap="wrap">
            <Box>
              <Text fontWeight="semibold">{t('frontOffice.search.title')}</Text>
              <Text fontSize="xs" color="gray.500">
                {t('frontOffice.search.help')}
              </Text>
            </Box>
            {active && (
              <Button size="xs" variant="ghost" onClick={onClear}>
                {t('frontOffice.action.clearFilters')}
              </Button>
            )}
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
            <Field label={t('frontOffice.search.guestLabel')}>
              <Input
                value={inputs.q}
                placeholder={t('frontOffice.search.guestPlaceholder')}
                onChange={(event) => onChange('q', event.target.value)}
              />
            </Field>
            <Field label={t('frontOffice.search.from')}>
              <DateField
                value={inputs.fromDate}
                onChange={(value) => onChange('fromDate', value)}
                placeholder={t('frontOffice.search.anyDate')}
                ariaLabel={t('frontOffice.search.from')}
              />
            </Field>
            <Field label={t('frontOffice.search.to')}>
              <DateField
                value={inputs.toDate}
                onChange={(value) => onChange('toDate', value)}
                placeholder={t('frontOffice.search.anyDate')}
                ariaLabel={t('frontOffice.search.to')}
              />
            </Field>
            <Field label={t('frontOffice.search.status')}>
              <Select
                value={inputs.status}
                onChange={(event) =>
                  onChange('status', event.target.value as ReservationStatus | '')
                }
              >
                <option value="">{t('frontOffice.search.allStatuses')}</option>
                {(Object.keys(RESERVATION_STATUS_COLORS) as ReservationStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {reservationStatusLabel(locale, value)}
                  </option>
                ))}
              </Select>
            </Field>
          </SimpleGrid>
          <HStack justify="space-between" wrap="wrap">
            <Text fontSize="xs" color="gray.500">
              {t('frontOffice.search.datesHint')}
            </Text>
            <Button type="submit" size="sm" colorScheme="brand" isLoading={loading}>
              {t('frontOffice.action.search')}
            </Button>
          </HStack>
        </Stack>
      </form>
    </SectionCard>
  );
}
