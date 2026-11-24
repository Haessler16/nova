'use client';

import { Box, Button, HStack, Stack } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { ReservationParty as ReservationPartyResponse } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { QueryFeedback } from '../ui';
import { isMember, type EditorState } from './lib/party-utils';
import { usePartyActions } from './lib/use-party-actions';
import { PartyEditorModal } from './party-editor-modal';
import { PartyHeader } from './party-header';
import { PartyMemberList } from './party-member-list';
import { PartySummary } from './party-summary';

export function ReservationParty({
  reservationId,
  checkInDate,
  editable,
  onChanged,
}: {
  reservationId: string;
  checkInDate: string;
  editable: boolean;
  onChanged?: () => void;
}) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const { version, reload, removingId, removeMember } = usePartyActions({
    reservationId,
    onChanged,
  });

  const party = useAsyncData<ReservationPartyResponse>(async () => {
    if (tenant.organizationId === null || tenant.propertyId === null) {
      throw new Error(t('party.empty'));
    }
    return api<ReservationPartyResponse>(`/api/v1/reservations/${reservationId}/party`, {
      tenant,
    });
  }, `${tenant.organizationId}:${tenant.propertyId}:${reservationId}:party:${version}`);

  const data = party.data;
  const members = data === null ? [] : [data.primary, ...data.companions].filter(isMember);

  return (
    <Box borderTopWidth="1px" borderColor="line" pt={4} data-testid="reservation-party">
      <PartyHeader party={data ?? null} />

      <QueryFeedback
        loading={party.loading}
        error={party.error}
        onRetry={party.reload}
        isEmpty={data === null}
        emptyText={t('party.empty')}
      >
        {data !== null && (
          <Stack spacing={3}>
            <PartySummary party={data} />

            <PartyMemberList
              members={members}
              editable={editable}
              removingId={removingId}
              onEdit={(member) =>
                setEditor({
                  kind:
                    member.ageGroup === 'MINOR' &&
                    (member.ageAtCheckIn === null || member.ageAtCheckIn < 18)
                      ? 'minor'
                      : 'adult',
                  member,
                })
              }
              onRemove={(member) => void removeMember(member)}
            />

            {editable && (
              <HStack spacing={2} wrap="wrap" pt={1}>
                <Button
                  data-testid="add-adult"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditor({ kind: 'adult', member: null })}
                >
                  {t('party.addAdult')}
                </Button>
                <Button
                  data-testid="add-minor"
                  size="sm"
                  colorScheme="brand"
                  onClick={() => setEditor({ kind: 'minor', member: null })}
                >
                  {t('party.addMinor')}
                </Button>
              </HStack>
            )}
          </Stack>
        )}
      </QueryFeedback>

      {editor !== null && data !== null && (
        <PartyEditorModal
          key={`${editor.kind}:${editor.member?.reservationGuestId ?? 'new'}`}
          editor={editor}
          party={data}
          reservationId={reservationId}
          checkInDate={checkInDate}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}
    </Box>
  );
}
