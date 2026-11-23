'use client';

import { Alert, AlertIcon, Box, Button, Checkbox, Divider, HStack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import { QueryFeedback, SectionCard } from '../ui';
import { InstructionCreateModal } from './instruction-create-modal';
import { InstructionEditModal } from './instruction-edit-modal';
import { InstructionsList } from './instructions-list';
import { InstructionsSourceSection } from './instructions-source-section';
import { ParsedSuggestions } from './parsed-suggestions';
import { SourceNotesCollapse } from './source-notes-collapse';
import { useInstructionCreate } from './use-instruction-create';
import { useInstructionEdit } from './use-instruction-edit';
import { useInstructionList } from './use-instruction-list';
import { useInstructionSource } from './use-instruction-source';

interface InstructionsPanelProps {
  reservationId: string;
  /** Hide mutating controls for read-only roles. The API still enforces RBAC. */
  canManage: boolean;
  onChanged?: () => void;
}

export function ReservationInstructions({
  reservationId,
  canManage,
  onChanged,
}: InstructionsPanelProps) {
  const { t } = useI18n();
  const instructions = useInstructionList(reservationId, onChanged);
  const create = useInstructionCreate(reservationId, instructions.notifyChanged);
  const edit = useInstructionEdit(reservationId, instructions.notifyChanged);
  const source = useInstructionSource(
    reservationId,
    instructions.sourceNotes.reload,
    instructions.notifyChanged,
  );

  return (
    <SectionCard>
      <HStack justify="space-between" align="center" mb={3} wrap="wrap">
        <Box>
          <Text fontWeight="semibold">{t('instructions.title')}</Text>
          <Text fontSize="xs" color="gray.500">
            {instructions.pendingCount === 0
              ? t('instructions.pendingNone')
              : instructions.pendingCount === 1
                ? t('instructions.pendingOne', { count: instructions.pendingCount })
                : t('instructions.pendingOther', { count: instructions.pendingCount })}
          </Text>
        </Box>
        <HStack spacing={2}>
          <Checkbox
            size="sm"
            isChecked={instructions.showCompleted}
            onChange={(event) => instructions.setShowCompleted(event.target.checked)}
          >
            {t('instructions.showClosed')}
          </Checkbox>
          {canManage && (
            <Button size="xs" variant="outline" onClick={create.modal.onOpen}>
              {t('instructions.new')}
            </Button>
          )}
        </HStack>
      </HStack>

      {instructions.highlighted.length > 0 && (
        <Alert status="warning" borderRadius="md" mb={3}>
          <AlertIcon />
          <Text fontSize="sm">
            {instructions.highlighted.length === 1
              ? t('instructions.highlightOne', { count: instructions.highlighted.length })
              : t('instructions.highlightOther', { count: instructions.highlighted.length })}
          </Text>
        </Alert>
      )}

      <QueryFeedback
        loading={instructions.list.loading}
        error={instructions.list.error}
        onRetry={instructions.list.reload}
        isEmpty={instructions.items.length === 0}
        emptyText={t('instructions.empty')}
      >
        <InstructionsList
          actions={instructions.actions}
          information={instructions.information}
          canManage={canManage}
          busyAction={instructions.busyAction}
          events={instructions.events}
          eventsLoading={instructions.eventsLoading}
          onTransition={(item, path, status) => void instructions.handleTransition(item, path, status)}
          onToggleEvents={(item) => void instructions.toggleEvents(item)}
          onEdit={edit.open}
        />
      </QueryFeedback>

      <Divider my={4} />

      <InstructionsSourceSection source={source} canManage={canManage} />

      <ParsedSuggestions source={source} />

      {(instructions.sourceNotes.data?.items.length ?? 0) > 0 && (
        <SourceNotesCollapse
          notes={instructions.sourceNotes.data?.items ?? []}
          isOpen={source.showSourceText}
          onToggle={source.toggleSourceText}
        />
      )}

      <InstructionCreateModal create={create} />
      <InstructionEditModal edit={edit} />
    </SectionCard>
  );
}
