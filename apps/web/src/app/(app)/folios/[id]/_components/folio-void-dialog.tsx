'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { validationCopy } from '../../../reservations/_lib/reservation-labels';
import type { FolioLine } from '@/lib/types';
import { buildErrors, hasErrors, reasonField, type FieldErrors } from '@/lib/validation';
import type { FolioAction } from '../_lib/use-folio-action';

export function FolioVoidDialog({
  folioId,
  target,
  currency,
  isOpen,
  onClose,
  action,
}: {
  folioId: string;
  target: FolioLine | null;
  currency: string | undefined;
  isOpen: boolean;
  onClose: () => void;
  action: FolioAction;
}) {
  const { t } = useI18n();
  const { tenant } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reason, setReason] = useState('');

  // The original page cleared the reason every time the dialog was opened.
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (target === null) return;
    const nextErrors = buildErrors([
      [
        'void.reason',
        reasonField(reason, t('folioDetail.validation.reason'), {}, validationCopy(t)),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    await action.run(
      'void',
      () =>
        api(`/api/v1/folios/${folioId}/charges/${target.id}/void`, {
          method: 'POST',
          tenant,
          body: {
            reason,
            idempotencyKey: `void-ui-${crypto.randomUUID()}`,
          },
        }),
      t('folioDetail.toast.voided'),
      () => {
        setReason('');
        onClose();
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>{t('folioDetail.void.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text fontSize="sm">
              {target?.description} · {formatMoney(target?.amount, currency)}
            </Text>
            <Field label={t('folioDetail.void.reason')} isRequired error={errors['void.reason']}>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                required
              />
            </Field>
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            {t('folioDetail.void.close')}
          </Button>
          <Button type="submit" colorScheme="danger" isLoading={action.busy === 'void'}>
            {t('folioDetail.void.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
