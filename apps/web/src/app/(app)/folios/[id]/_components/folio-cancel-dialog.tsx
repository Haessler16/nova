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
import { useI18n } from '@/lib/i18n';
import { validationCopy } from '../../../reservations/_lib/reservation-labels';
import { buildErrors, hasErrors, reasonField, type FieldErrors } from '@/lib/validation';
import type { FolioAction } from '../_lib/use-folio-action';

export function FolioCancelDialog({
  folioId,
  isOpen,
  onClose,
  action,
}: {
  folioId: string;
  isOpen: boolean;
  onClose: () => void;
  action: FolioAction;
}) {
  const { t } = useI18n();
  const { tenant } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = buildErrors([
      [
        'cancel.reason',
        reasonField(reason, t('folioDetail.validation.reason'), {}, validationCopy(t)),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    await action.run(
      'cancel',
      () =>
        api(`/api/v1/folios/${folioId}/cancel`, {
          method: 'POST',
          tenant,
          body: {
            reason,
            idempotencyKey: `cancel-ui-${crypto.randomUUID()}`,
          },
        }),
      t('folioDetail.toast.cancelled'),
      onClose,
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>{t('folioDetail.cancelModal.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text fontSize="sm" color="textSecondary">
              {t('folioDetail.cancelModal.description')}
            </Text>
            <Field
              label={t('folioDetail.cancelModal.reason')}
              isRequired
              error={errors['cancel.reason']}
            >
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
            {t('folioDetail.cancelModal.back')}
          </Button>
          <Button type="submit" colorScheme="danger" isLoading={action.busy === 'cancel'}>
            {t('folioDetail.cancelModal.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
