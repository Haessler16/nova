'use client';

import { Box, Button, Select, Stack, Text, Textarea, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PilotFeedback, PilotFeedbackCategory } from '@/lib/pilot-types';
import { CATEGORY_KEYS } from '../_lib/pilot-meta';

export function PilotFeedbackForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [category, setCategory] = useState<PilotFeedbackCategory>('UX');
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (message.trim().length < 8) {
      toast({ title: t('pilot.toast.short'), status: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await api<PilotFeedback>('/api/v1/pilot/feedback', {
        method: 'POST',
        tenant,
        body: {
          category,
          message: message.trim(),
          ...(rating !== '' ? { rating: Number(rating) } : {}),
          context: { route: '/pilot', appVersion: 'phase-6' },
        },
      });
      setMessage('');
      setRating('');
      toast({ title: t('pilot.toast.sent'), status: 'success' });
      onSubmitted();
    } catch (cause) {
      toast({
        title: t('pilot.toast.sendError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard>
      <Text fontWeight="semibold" mb={1}>
        {t('pilot.feedback.title')}
      </Text>
      <Text fontSize="sm" color="textSecondary" mb={4}>
        {t('pilot.feedback.privacy')}
      </Text>
      <Box as="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          <Field label={t('pilot.feedback.category')} isRequired>
            <Select
              size="sm"
              value={category}
              onChange={(event) => setCategory(event.target.value as PilotFeedbackCategory)}
            >
              {(Object.keys(CATEGORY_KEYS) as PilotFeedbackCategory[]).map((key) => (
                <option key={key} value={key}>
                  {t(CATEGORY_KEYS[key])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('pilot.feedback.rating')} helper={t('pilot.feedback.ratingHelper')}>
            <Select size="sm" value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">{t('pilot.feedback.unrated')}</option>
              <option value="1">{t('pilot.feedback.rating1')}</option>
              <option value="2">{t('pilot.feedback.rating2')}</option>
              <option value="3">{t('pilot.feedback.rating3')}</option>
              <option value="4">{t('pilot.feedback.rating4')}</option>
              <option value="5">{t('pilot.feedback.rating5')}</option>
            </Select>
          </Field>
          <Field
            label={t('pilot.feedback.message')}
            isRequired
            helper={t('pilot.feedback.messageHelper')}
          >
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={4000}
            />
          </Field>
          <Button type="submit" colorScheme="brand" alignSelf="flex-start" isLoading={submitting}>
            {t('pilot.feedback.submit')}
          </Button>
        </Stack>
      </Box>
    </SectionCard>
  );
}
