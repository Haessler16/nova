'use client';

import { Button, HStack, Input, Text } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import type { FormEvent } from 'react';
import { useI18n } from '@/lib/i18n';
import type { AuditFilters } from '../audit-filters';

export function AuditFilterBar({
  inputs,
  total,
  onChange,
  onSubmit,
  onReset,
}: {
  inputs: AuditFilters;
  total: number;
  onChange: (filters: AuditFilters) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit}>
      <HStack wrap="wrap" spacing={2} mb={4} align="flex-end">
        <Input
          size="sm"
          width="230px"
          placeholder={t('audit.filter.actionPlaceholder')}
          aria-label={t('audit.filter.actionLabel')}
          value={inputs.action}
          onChange={(event) => onChange({ ...inputs, action: event.target.value })}
        />
        <Input
          size="sm"
          width="190px"
          placeholder={t('audit.filter.entityPlaceholder')}
          aria-label={t('audit.filter.entityLabel')}
          value={inputs.entityType}
          onChange={(event) => onChange({ ...inputs, entityType: event.target.value })}
        />
        <Input
          size="sm"
          width="250px"
          placeholder={t('audit.filter.actorPlaceholder')}
          aria-label={t('audit.filter.actorLabel')}
          value={inputs.actorUserId}
          onChange={(event) => onChange({ ...inputs, actorUserId: event.target.value })}
        />
        <HStack spacing={1}>
          <Text fontSize="xs" color="textSecondary">
            {t('audit.filter.from')}
          </Text>
          <DateField
            size="sm"
            width="150px"
            value={inputs.fromDate}
            placeholder={t('audit.filter.datePlaceholder')}
            ariaLabel={t('audit.filter.fromLabel')}
            isClearable
            onChange={(fromDate) =>
              onChange({
                ...inputs,
                fromDate,
                ...(inputs.toDate !== '' && inputs.toDate <= fromDate ? { toDate: '' } : {}),
              })
            }
          />
          <Text fontSize="xs" color="textSecondary">
            {t('audit.filter.to')}
          </Text>
          <DateField
            size="sm"
            width="150px"
            value={inputs.toDate}
            {...(inputs.fromDate !== '' ? { min: inputs.fromDate } : {})}
            placeholder={t('audit.filter.datePlaceholder')}
            ariaLabel={t('audit.filter.toLabel')}
            isClearable
            onChange={(toDate) => onChange({ ...inputs, toDate })}
          />
        </HStack>
        <Button size="sm" type="submit" variant="outline">
          {t('audit.filter.submit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          {t('audit.filter.reset')}
        </Button>
        <Text fontSize="xs" color="textSecondary" ml="auto">
          {t('audit.filter.count', { total })}
        </Text>
      </HStack>
    </form>
  );
}
