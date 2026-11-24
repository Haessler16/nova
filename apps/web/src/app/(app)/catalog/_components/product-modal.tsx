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
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { FolioProduct } from '@/lib/types';
import {
  buildErrors,
  hasErrors,
  moneyField,
  optionalText,
  requiredText,
  type FieldErrors,
} from '@/lib/validation';
import { validationCopy } from '../../reservations/_lib/reservation-labels';
import { EMPTY_FORM, type ProductForm } from '../_lib/product-form';
import { ProductFormFields } from './product-form-fields';

function formFromProduct(product: FolioProduct): ProductForm {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    category: product.category,
    unit: product.unit,
    unitAmount: product.unitAmount,
  };
}

export function ProductModal({
  isOpen,
  onClose,
  editing,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: FolioProduct | null;
  onSaved: () => void;
}) {
  const { tenant, property } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  // The original page reset the form right before opening the modal.
  useEffect(() => {
    if (isOpen) {
      setForm(editing === null ? EMPTY_FORM : formFromProduct(editing));
      setErrors({});
    }
  }, [isOpen, editing]);

  const currency = property?.currencyCode ?? 'BRL';

  async function submitForm(event: FormEvent): Promise<void> {
    event.preventDefault();
    const copy = validationCopy(t);
    const nextErrors = buildErrors([
      [
        'sku',
        editing === null
          ? requiredText(form.sku, t('catalog.validation.sku'), { max: 32 }, copy)
          : null,
      ],
      ['name', requiredText(form.name, t('catalog.validation.name'), { max: 120 }, copy)],
      ['unit', requiredText(form.unit, t('catalog.validation.unit'), { max: 8 }, copy)],
      [
        'unitAmount',
        moneyField(form.unitAmount, t('catalog.validation.price'), { allowZero: false }, copy),
      ],
      [
        'description',
        optionalText(form.description, t('catalog.validation.description'), { max: 400 }, copy),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }

    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() === '' ? undefined : form.description.trim(),
        category: form.category,
        unit: form.unit.trim(),
        unitAmount: form.unitAmount,
        ...(editing === null ? { sku: form.sku.trim() } : {}),
      };
      if (editing === null) {
        await api<FolioProduct>('/api/v1/products', { method: 'POST', tenant, body });
        toast({ title: t('catalog.toast.created'), status: 'success' });
      } else {
        await api<FolioProduct>(`/api/v1/products/${editing.id}`, {
          method: 'PATCH',
          tenant,
          body,
        });
        toast({ title: t('catalog.toast.updated'), status: 'success' });
      }
      onClose();
      onSaved();
    } catch (cause) {
      toast({
        title: t('catalog.toast.saveError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submitForm}>
        <ModalHeader>
          {editing === null ? t('catalog.modal.create') : t('catalog.modal.edit')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <ProductFormFields
            form={form}
            onChange={setForm}
            errors={errors}
            editing={editing}
            currency={currency}
          />
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={busy}>
            {editing === null ? t('catalog.submit.create') : t('catalog.submit.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
