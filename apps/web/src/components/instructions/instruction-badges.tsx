'use client';

import { Badge, HStack } from '@chakra-ui/react';
import {
  INSTRUCTION_PRIORITY_COLORS,
  instructionActionLabel,
  instructionCategoryLabel,
  instructionMomentLabel,
  instructionPriorityLabel,
  instructionVisibilityLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationInstruction } from '@/lib/types';
import { StatusBadge } from '../ui';

export function InstructionBadges({ instruction }: { instruction: ReservationInstruction }) {
  const { t, locale } = useI18n();

  return (
    <HStack spacing={2} wrap="wrap">
      <StatusBadge
        color={INSTRUCTION_PRIORITY_COLORS[instruction.priority]}
        label={instructionPriorityLabel(locale, instruction.priority)}
      />
      <Badge colorScheme="gray">{instructionCategoryLabel(locale, instruction.category)}</Badge>
      {instruction.tags.map((tag) => (
        <Badge key={tag} colorScheme="purple" variant="subtle" textTransform="none">
          {tag}
        </Badge>
      ))}
      {instruction.category === 'CONFIDENTIAL' && (
        <Badge colorScheme="danger" textTransform="none">
          {t('instructions.confidential')}
        </Badge>
      )}
      {instruction.actionType !== null && (
        <Badge colorScheme="brand" textTransform="none">
          {instructionActionLabel(locale, instruction.actionType)}
        </Badge>
      )}
      {instruction.executionMoment !== null && (
        <Badge colorScheme="gray" textTransform="none">
          {instructionMomentLabel(locale, instruction.executionMoment)}
        </Badge>
      )}
      {instruction.visibility !== 'ALL_AUTHORIZED' && (
        <Badge colorScheme="gray" textTransform="none">
          {instructionVisibilityLabel(locale, instruction.visibility)}
        </Badge>
      )}
    </HStack>
  );
}
