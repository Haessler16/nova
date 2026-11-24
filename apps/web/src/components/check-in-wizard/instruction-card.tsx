'use client';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import { StatusBadge } from '@/components/ui';
import {
  INSTRUCTION_PRIORITY_COLORS,
  instructionActionLabel,
  instructionCategoryLabel,
  instructionMomentLabel,
  instructionPriorityLabel,
  instructionStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationInstruction } from '@/lib/types';

export function InstructionCard({
  instruction,
  busy,
  onAcknowledge,
}: {
  instruction: ReservationInstruction;
  busy: boolean;
  onAcknowledge: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
      <HStack spacing={2} wrap="wrap">
        <StatusBadge
          color={INSTRUCTION_PRIORITY_COLORS[instruction.priority]}
          label={instructionPriorityLabel(locale, instruction.priority)}
        />
        <Badge colorScheme="gray">{instructionCategoryLabel(locale, instruction.category)}</Badge>
        {instruction.executionMoment !== null && (
          <Badge colorScheme="brand" textTransform="none">
            {instructionMomentLabel(locale, instruction.executionMoment)}
          </Badge>
        )}
        {instruction.status !== 'NEW' && (
          <Badge colorScheme="gray" textTransform="none">
            {instruction.status === 'ACKNOWLEDGED'
              ? t('checkIn.instructions.read')
              : instructionStatusLabel(locale, instruction.status)}
          </Badge>
        )}
      </HStack>
      <Text fontWeight="semibold" mt={1}>
        {instruction.title}
      </Text>
      <Text fontSize="sm" mt={1}>
        {instruction.body}
      </Text>
      {instruction.actionType === 'PAYMENT_PREAUTHORIZATION' && (
        <Text fontSize="xs" color="warning.600" mt={1}>
          {t('checkIn.instructions.actionNote', {
            action: instructionActionLabel(locale, instruction.actionType),
          })}
        </Text>
      )}
      {instruction.status === 'NEW' && (
        <Button
          mt={2}
          size="xs"
          variant="outline"
          colorScheme="brand"
          isLoading={busy}
          onClick={onAcknowledge}
        >
          {t('checkIn.instructions.ack')}
        </Button>
      )}
    </Box>
  );
}
