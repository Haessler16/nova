'use client';

import { Button, HStack } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { PageHeader } from '@/components/ui';
import { formatCalendarDate, formatLongDate, todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';

export function FrontOfficeHeader({
  data,
  referenceDate,
  propertyTimezone,
  reloading,
  onChangeDate,
  onReload,
}: {
  data: FrontOfficeOverview | null;
  referenceDate: string;
  propertyTimezone: string | undefined;
  reloading: boolean;
  onChangeDate: (date: string) => void;
  onReload: () => void;
}) {
  const { t } = useI18n();
  const isHistorical = data?.isHistorical ?? false;

  return (
    <PageHeader
      title="Front Office"
      description={
        data !== null
          ? data.isHistorical
            ? t('frontOffice.description.historical', {
                date: formatLongDate(data.selectedDate),
              })
            : t('frontOffice.description.operational', {
                date: formatCalendarDate(data.operationalDate),
                time: data.localTime,
                timezone: data.timezone,
                start: data.operationalDayStart,
              })
          : t('frontOffice.description.default')
      }
      actions={
        <HStack spacing={2} wrap="wrap">
          <DateField
            value={referenceDate}
            onChange={onChangeDate}
            placeholder={t('frontOffice.date.placeholder')}
            ariaLabel={t('frontOffice.date.aria')}
            max={data?.operationalDate}
            today={data?.operationalDate ?? todayISO(0, propertyTimezone)}
            width="168px"
          />
          <Button
            size="sm"
            variant={isHistorical ? 'solid' : 'outline'}
            colorScheme={isHistorical ? 'warning' : undefined}
            onClick={() => onChangeDate(data?.operationalDate ?? '')}
            isDisabled={!isHistorical}
          >
            {t('frontOffice.action.today')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReload}
            isLoading={reloading && data !== null}
          >
            {t('frontOffice.action.refresh')}
          </Button>
        </HStack>
      }
    />
  );
}
