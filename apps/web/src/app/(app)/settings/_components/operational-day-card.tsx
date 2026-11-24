'use client';

import { Stack, Text } from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { OperationalDay } from '@/lib/types';

export function OperationalDayCard({ operationalDay }: { operationalDay: OperationalDay }) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        {t('settings.day.title')}
      </Text>
      <Stack spacing={2} mt={3}>
        <KeyValue
          label={t('settings.day.operationalDate')}
          value={formatCalendarDate(operationalDay.operationalDate)}
        />
        <KeyValue
          label={t('settings.day.localDate')}
          value={formatCalendarDate(operationalDay.localDate)}
        />
        <KeyValue label={t('settings.day.localTime')} value={operationalDay.localTime} />
        <KeyValue label={t('settings.day.cutoff')} value={operationalDay.operationalDayStart} />
        <KeyValue label={t('settings.day.timezone')} value={operationalDay.timezone} />
      </Stack>
    </SectionCard>
  );
}
