'use client';

import { Box, Flex, Heading, HStack, Link, SimpleGrid, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  CalendarIcon,
  FrontDeskIcon,
  GridIcon,
  KeyIcon,
  PlusIcon,
} from '@/components/icons';
import { useI18n, type TranslationKey } from '@/lib/i18n';

const ACTION_TONES = {
  brand: { bg: 'brand.50', color: 'brand.600' },
  sky: { bg: 'sky.50', color: 'sky.600' },
  mint: { bg: 'mint.50', color: 'mint.600' },
  warning: { bg: 'warning.50', color: 'warning.700' },
} as const;

const QUICK_ACTIONS = [
  {
    href: '/front-office',
    labelKey: 'dashboard.quickActions.frontDesk.label',
    descriptionKey: 'dashboard.quickActions.frontDesk.description',
    icon: <FrontDeskIcon boxSize={5} />,
    tone: 'brand',
  },
  {
    href: '/reservations?new=1',
    labelKey: 'dashboard.quickActions.newReservation.label',
    descriptionKey: 'dashboard.quickActions.newReservation.description',
    icon: <PlusIcon boxSize={5} />,
    tone: 'sky',
  },
  {
    href: '/front-office?tab=arrivals',
    labelKey: 'dashboard.quickActions.checkIn.label',
    descriptionKey: 'dashboard.quickActions.checkIn.description',
    icon: <KeyIcon boxSize={5} />,
    tone: 'mint',
  },
  {
    href: '/front-office?tab=rack',
    labelKey: 'dashboard.quickActions.rack.label',
    descriptionKey: 'dashboard.quickActions.rack.description',
    icon: <GridIcon boxSize={5} />,
    tone: 'warning',
  },
  {
    href: '/calendar',
    labelKey: 'dashboard.quickActions.calendar.label',
    descriptionKey: 'dashboard.quickActions.calendar.description',
    icon: <CalendarIcon boxSize={5} />,
    tone: 'brand',
  },
] as const satisfies ReadonlyArray<{
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ReactNode;
  tone: keyof typeof ACTION_TONES;
}>;

export function QuickActions() {
  const { t } = useI18n();

  return (
    <Box>
      <HStack justify="space-between" align="baseline" mb={3}>
        <Heading size="sm">{t('dashboard.quickActions.title')}</Heading>
        <Text fontSize="xs" color="textSecondary">
          {t('dashboard.quickActions.hint')}
        </Text>
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 5 }} spacing={3}>
        {QUICK_ACTIONS.map((action) => {
          const tone = ACTION_TONES[action.tone];
          return (
            <Link
              key={action.href}
              as={NextLink}
              href={action.href}
              display="block"
              borderWidth="1px"
              borderColor="line"
              borderRadius="xl"
              bg="surface"
              boxShadow="card"
              p={4}
              color="inherit"
              transition="border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease"
              _hover={{
                borderColor: 'brand.300',
                boxShadow: 'cardHover',
                transform: 'translateY(-1px)',
                textDecoration: 'none',
              }}
              _focusVisible={{ boxShadow: 'focus', outline: 'none' }}
            >
              <HStack justify="space-between" align="flex-start">
                <Flex
                  boxSize="38px"
                  align="center"
                  justify="center"
                  borderRadius="lg"
                  bg={tone.bg}
                  color={tone.color}
                >
                  {action.icon}
                </Flex>
                <Box color="gray.300" mt={1}>
                  <ArrowRightIcon boxSize={4} />
                </Box>
              </HStack>
              <Text fontWeight="semibold" fontSize="sm" mt={3}>
                {t(action.labelKey)}
              </Text>
              <Text fontSize="xs" color="textSecondary" mt={0.5} noOfLines={2}>
                {t(action.descriptionKey)}
              </Text>
            </Link>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
