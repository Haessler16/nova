'use client';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import { documentTypeLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationPartyMember } from '@/lib/types';
import { supervisionLabel } from './lib/party-labels';
import { maskDocument } from './lib/party-utils';

export function PartyMemberRow({
  member,
  editable,
  removing,
  onEdit,
  onRemove,
}: {
  member: ReservationPartyMember;
  editable: boolean;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t, locale } = useI18n();
  const primary = member.role === 'PRIMARY';
  const minor = member.ageGroup === 'MINOR';
  const legal =
    minor &&
    (member.responsibleReservationGuestId === null ||
      member.minorSupervision === null ||
      member.minorSupervision === 'UNKNOWN' ||
      member.minorSupervision === 'UNACCOMPANIED_WITHOUT_AUTHORIZATION' ||
      (member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' && !member.authorizationReference));
  const description = member.documentType
    ? `${documentTypeLabel(locale, member.documentType)} ${maskDocument(member)}`
    : t('reservations.guest.noDocument');

  return (
    <Box
      data-testid="party-member"
      borderWidth="1px"
      borderColor={primary ? 'brand.200' : legal ? 'danger.200' : 'line'}
      borderLeftWidth={minor ? '4px' : '1px'}
      borderLeftColor={minor ? (legal ? 'danger.400' : 'mint.400') : undefined}
      borderRadius="md"
      ml={minor ? 4 : 0}
      px={3}
      py={2}
      bg={primary ? 'brand.50' : 'surface'}
    >
      <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={2}>
        <Box minW={0}>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" fontWeight="semibold">
              {member.fullName}
            </Text>
            <Badge colorScheme={primary ? 'sky' : minor ? 'warning' : 'gray'} textTransform="none">
              {primary
                ? t('party.role.primary')
                : minor
                  ? t('party.role.minor')
                  : t('party.role.companion')}
            </Badge>
            <Badge colorScheme={legal ? 'danger' : 'gray'} textTransform="none">
              {member.ageGroup === 'ADULT'
                ? t('party.age.adult')
                : member.ageGroup === 'MINOR'
                  ? t('party.role.minor')
                  : t('party.age.unclassified')}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.600">
            {description}
            {member.email ? ` · ${member.email}` : ''}
            {member.ageAtCheckIn !== null
              ? ` ${t('party.age.atCheckIn', { age: member.ageAtCheckIn })}`
              : ''}
          </Text>
          {minor && (
            <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.600'}>
              {t('party.member.responsible', {
                name: member.responsibleName ?? t('party.member.noResponsible'),
              })}{' '}
              ·{' '}
              {member.minorSupervision
                ? supervisionLabel(t, member.minorSupervision)
                : t('party.member.noSupervision')}
              {member.minorSupervision === 'UNACCOMPANIED_AUTHORIZED'
                ? ` ${t('party.member.authorizationRef', {
                    reference: member.authorizationReference ?? t('party.member.referenceMissing'),
                  })}`
                : ''}
            </Text>
          )}
          <Text fontSize="xs" color={legal ? 'danger.600' : 'gray.500'}>
            {minor
              ? t('party.member.fnrhIncluded')
              : member.documentType === 'CPF' || member.documentType === 'PASSPORT'
                ? t('party.member.fnrhValid')
                : t('party.member.fnrhMissing')}
          </Text>
        </Box>
        {editable && (
          <HStack spacing={1}>
            <Button size="xs" variant="ghost" onClick={onEdit}>
              {t('reservations.row.edit')}
            </Button>
            {!primary && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="danger"
                onClick={onRemove}
                isLoading={removing}
              >
                {t('party.member.remove')}
              </Button>
            )}
          </HStack>
        )}
      </HStack>
    </Box>
  );
}
