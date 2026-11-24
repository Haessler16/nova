'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PilotFeedback } from '@/lib/pilot-types';
import { useAsyncData } from '@/lib/use-async-data';
import { PilotChecklist } from './_components/pilot-checklist';
import { PilotFeedbackForm } from './_components/pilot-feedback-form';
import { PilotFeedbackList } from './_components/pilot-feedback-list';

function PilotContent() {
  const { tenant } = useSession();
  const { t } = useI18n();

  const feedback = useAsyncData<{ items: PilotFeedback[] }>(
    () => api<{ items: PilotFeedback[] }>('/api/v1/pilot/feedback', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:pilot-feedback`,
  );

  return (
    <>
      <PageHeader
        eyebrow={t('pilot.eyebrow')}
        title={t('pilot.title')}
        description={t('pilot.description')}
      />

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} mb={5}>
        <PilotChecklist />
        <PilotFeedbackForm onSubmitted={feedback.reload} />
      </SimpleGrid>

      <PilotFeedbackList
        items={feedback.data?.items ?? []}
        loading={feedback.loading}
        error={feedback.error}
        onRetry={feedback.reload}
        onReviewed={feedback.reload}
      />
    </>
  );
}

export default function PilotPage() {
  return (
    <PropertyGate>
      <PilotContent />
    </PropertyGate>
  );
}
