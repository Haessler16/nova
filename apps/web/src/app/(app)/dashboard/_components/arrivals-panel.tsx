'use client';

import {
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Skeleton,
  SkeletonCircle,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { EmptyState, SectionCard } from '@/components/ui';
import { ArrowRightIcon } from '@/components/icons';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview } from '@/lib/types';
import { ArrivalRow } from './arrival-row';

function ArrivalsSkeleton() {
  return (
    <Stack spacing={3}>
      {[0, 1, 2, 3].map((row) => (
        <HStack key={row} spacing={3} py={2}>
          <SkeletonCircle size="9" />
          <Box flex="1">
            <Skeleton height="14px" width="55%" borderRadius="md" />
            <Skeleton height="11px" width="75%" mt={2} borderRadius="md" />
          </Box>
          <Skeleton height="22px" width="72px" borderRadius="full" />
        </HStack>
      ))}
    </Stack>
  );
}

export function ArrivalsPanel({
  data,
  loading,
  operationalDate,
}: {
  data: FrontOfficeOverview | null;
  loading: boolean;
  operationalDate: string | null;
}) {
  const { t } = useI18n();
  const arrivals = data?.arrivals ?? [];
  const count = data?.counts.arrivals ?? 0;

  return (
    <SectionCard h="100%">
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
        <Box>
          <Heading size="sm">{t('dashboard.arrivals.title')}</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {data !== null
              ? `${
                  count === 1
                    ? t('dashboard.arrivals.countOne', { count })
                    : t('dashboard.arrivals.countOther', { count })
                }${operationalDate !== null ? ` · ${formatCalendarDate(operationalDate)}` : ''}`
              : t('dashboard.arrivals.pending')}
          </Text>
        </Box>
        <Button
          as={NextLink}
          href="/front-office?tab=arrivals"
          size="xs"
          variant="ghost"
          rightIcon={<ArrowRightIcon boxSize={3.5} />}
        >
          {t('dashboard.arrivals.viewAll')}
        </Button>
      </Flex>

      <Divider my={4} />

      {loading && data === null ? (
        <ArrivalsSkeleton />
      ) : arrivals.length === 0 ? (
        <EmptyState text={t('dashboard.arrivals.empty')} hint={t('dashboard.arrivals.emptyHint')} />
      ) : (
        <Stack spacing={0}>
          {arrivals.slice(0, 6).map((reservation) => (
            <ArrivalRow key={reservation.id} reservation={reservation} />
          ))}
        </Stack>
      )}

      {arrivals.length > 6 && (
        <Button
          as={NextLink}
          href="/front-office?tab=arrivals"
          size="sm"
          variant="ghost"
          width="100%"
          mt={3}
          rightIcon={<ArrowRightIcon boxSize={4} />}
        >
          {t('dashboard.arrivals.viewCount', { count: arrivals.length })}
        </Button>
      )}
    </SectionCard>
  );
}
