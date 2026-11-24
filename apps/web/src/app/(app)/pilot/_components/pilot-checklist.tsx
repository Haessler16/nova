'use client';

import { Box, Button, Checkbox, HStack, Link, Progress, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/ui';
import { useI18n, type TranslationKey } from '@/lib/i18n';

const CHECKLIST_STORAGE_KEY = 'nova.pilot.checklist.v1';

const ONBOARDING_STEPS = [
  {
    id: 'property',
    titleKey: 'pilot.step.property.title',
    descriptionKey: 'pilot.step.property.description',
    href: '/settings',
  },
  {
    id: 'rooms',
    titleKey: 'pilot.step.rooms.title',
    descriptionKey: 'pilot.step.rooms.description',
    href: '/inventory/rooms',
  },
  {
    id: 'guest',
    titleKey: 'pilot.step.guest.title',
    descriptionKey: 'pilot.step.guest.description',
    href: '/guests',
  },
  {
    id: 'reservation',
    titleKey: 'pilot.step.reservation.title',
    descriptionKey: 'pilot.step.reservation.description',
    href: '/reservations',
  },
  {
    id: 'front-office',
    titleKey: 'pilot.step.frontOffice.title',
    descriptionKey: 'pilot.step.frontOffice.description',
    href: '/front-office',
  },
  {
    id: 'folio',
    titleKey: 'pilot.step.folio.title',
    descriptionKey: 'pilot.step.folio.description',
    href: '/folios',
  },
  {
    id: 'cash',
    titleKey: 'pilot.step.cash.title',
    descriptionKey: 'pilot.step.cash.description',
    href: '/cashier',
  },
  {
    id: 'night-audit',
    titleKey: 'pilot.step.nightAudit.title',
    descriptionKey: 'pilot.step.nightAudit.description',
    href: '/cashier',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  href: string;
}>;

export function PilotChecklist() {
  const { t } = useI18n();
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw !== null) {
        setDone(JSON.parse(raw) as Record<string, boolean>);
      }
    } catch {
      // Corrupt local state must never block onboarding.
    }
  }, []);

  const completed = ONBOARDING_STEPS.filter((step) => done[step.id] === true).length;
  const progress = Math.round((completed / ONBOARDING_STEPS.length) * 100);

  function toggleStep(id: string): void {
    setDone((current) => {
      const next = { ...current, [id]: current[id] !== true };
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <SectionCard>
      <HStack justify="space-between" mb={1}>
        <Text fontWeight="semibold">{t('pilot.checklist.title')}</Text>
        <Text fontSize="sm" color="textSecondary">
          {completed}/{ONBOARDING_STEPS.length}
        </Text>
      </HStack>
      <Progress
        value={progress}
        size="sm"
        colorScheme="brand"
        borderRadius="full"
        mb={4}
        aria-label={t('pilot.checklist.progress', { percent: progress })}
      />
      <Stack spacing={3}>
        {ONBOARDING_STEPS.map((step) => (
          <HStack key={step.id} spacing={3} align="flex-start">
            <Checkbox
              isChecked={done[step.id] === true}
              onChange={() => toggleStep(step.id)}
              mt={0.5}
            />
            <Box flex="1">
              <Link
                as={NextLink}
                href={step.href}
                fontWeight="semibold"
                fontSize="sm"
                color="brand.700"
              >
                {t(step.titleKey)}
              </Link>
              <Text fontSize="xs" color="textSecondary">
                {t(step.descriptionKey)}
              </Text>
            </Box>
          </HStack>
        ))}
      </Stack>
      <Button
        mt={4}
        size="sm"
        variant="ghost"
        onClick={() => {
          window.localStorage.removeItem(CHECKLIST_STORAGE_KEY);
          setDone({});
        }}
      >
        {t('pilot.checklist.reset')}
      </Button>
    </SectionCard>
  );
}
