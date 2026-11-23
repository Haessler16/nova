'use client';

import { Stack, Text } from '@chakra-ui/react';
import { KeyValue, SectionCard } from '@/components/ui';
import { formatCalendarDate } from '@/lib/format';
import type { OperationalDay } from '@/lib/types';

export function OperationalDayCard({ operationalDay }: { operationalDay: OperationalDay }) {
  return (
    <SectionCard>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        Día operativo calculado
      </Text>
      <Stack spacing={2} mt={3}>
        <KeyValue
          label="Fecha operativa"
          value={formatCalendarDate(operationalDay.operationalDate)}
        />
        <KeyValue label="Fecha local" value={formatCalendarDate(operationalDay.localDate)} />
        <KeyValue label="Hora local" value={operationalDay.localTime} />
        <KeyValue label="Corte" value={operationalDay.operationalDayStart} />
        <KeyValue label="Timezone" value={operationalDay.timezone} />
      </Stack>
    </SectionCard>
  );
}
