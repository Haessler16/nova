'use client';

import {
  Badge,
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { PRODUCT_CATEGORY_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import type { FolioProduct, FolioProductCategory } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  buildErrors,
  hasErrors,
  moneyField,
  optionalText,
  requiredText,
  type FieldErrors,
} from '@/lib/validation';

const CATEGORIES: FolioProductCategory[] = [
  'MINIBAR',
  'FOOD_BEVERAGE',
  'PARKING',
  'LAUNDRY',
  'SERVICE',
  'OTHER',
];

interface ProductList {
  items: FolioProduct[];
}

const EMPTY_FORM = {
  sku: '',
  name: '',
  description: '',
  category: 'MINIBAR' as FolioProductCategory,
  unit: 'UN',
  unitAmount: '',
};

function CatalogContent() {
  const { tenant, property } = useSession();
  const toast = useToast();
  const modal = useDisclosure();

  const [filters, setFilters] = useState({ search: '', category: '', isActive: 'true' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<FolioProduct | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<string | null>(null);

  const products = useAsyncData<ProductList>(
    () => {
      const params = new URLSearchParams();
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      if (filters.category !== '') params.set('category', filters.category);
      if (filters.isActive !== '') params.set('isActive', filters.isActive);
      return api<ProductList>(`/api/v1/products?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:catalog:${JSON.stringify(filters)}`,
  );

  const currency = property?.currencyCode ?? 'BRL';

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    modal.onOpen();
  }

  function openEdit(product: FolioProduct): void {
    setEditing(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      category: product.category,
      unit: product.unit,
      unitAmount: product.unitAmount,
    });
    setErrors({});
    modal.onOpen();
  }

  async function submitForm(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = buildErrors([
      ['sku', editing === null ? requiredText(form.sku, 'El SKU', { max: 32 }) : null],
      ['name', requiredText(form.name, 'El nombre', { max: 120 })],
      ['unit', requiredText(form.unit, 'La unidad', { max: 8 })],
      ['unitAmount', moneyField(form.unitAmount, 'El precio', { allowZero: false })],
      ['description', optionalText(form.description, 'La descripción', { max: 400 })],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }

    setBusy('save');
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
        toast({ title: 'Producto creado', status: 'success' });
      } else {
        await api<FolioProduct>(`/api/v1/products/${editing.id}`, {
          method: 'PATCH',
          tenant,
          body,
        });
        toast({ title: 'Producto actualizado', status: 'success' });
      }
      modal.onClose();
      products.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo guardar el producto',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(product: FolioProduct): Promise<void> {
    setBusy(`toggle:${product.id}`);
    try {
      await api<FolioProduct>(`/api/v1/products/${product.id}`, {
        method: 'PATCH',
        tenant,
        body: { isActive: !product.isActive },
      });
      toast({
        title: product.isActive ? 'Producto desactivado' : 'Producto activado',
        status: 'success',
      });
      products.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo cambiar el estado',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  const items = products.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Caixa"
        title="Catálogo de consumos"
        description="Productos y servicios que recepción puede cargar a una cuenta. El precio se guarda en decimal con moneda de la propiedad y cada cargo conserva el precio aplicado al momento de registrarse."
        actions={
          <Button colorScheme="brand" onClick={openCreate}>
            Nuevo producto
          </Button>
        }
      />

      <SectionCard mb={5}>
        <HStack spacing={3} wrap="wrap" align="flex-end">
          <Field label="Buscar">
            <Input
              size="sm"
              placeholder="SKU o nombre"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </Field>
          <Field label="Categoría">
            <Select
              size="sm"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {PRODUCT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select
              size="sm"
              value={filters.isActive}
              onChange={(event) =>
                setFilters((current) => ({ ...current, isActive: event.target.value }))
              }
            >
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </Select>
          </Field>
        </HStack>
      </SectionCard>

      <SectionCard>
        <QueryFeedback
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          isEmpty={items.length === 0}
          emptyText="No hay productos para los filtros seleccionados."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>SKU</Th>
                  <Th>Nombre</Th>
                  <Th>Categoría</Th>
                  <Th>Unidad</Th>
                  <Th isNumeric>Precio</Th>
                  <Th>Estado</Th>
                  <Th>Actualizado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {items.map((product) => (
                  <Tr key={product.id} opacity={product.isActive ? 1 : 0.6}>
                    <Td fontFamily="mono" fontSize="xs">
                      {product.sku}
                    </Td>
                    <Td>
                      <Text fontSize="sm" fontWeight="semibold">
                        {product.name}
                      </Text>
                      {product.description !== null && (
                        <Text fontSize="xs" color="textSecondary" noOfLines={1}>
                          {product.description}
                        </Text>
                      )}
                    </Td>
                    <Td>{PRODUCT_CATEGORY_LABELS[product.category]}</Td>
                    <Td>{product.unit}</Td>
                    <Td isNumeric>{formatMoney(product.unitAmount, product.currencyCode)}</Td>
                    <Td>
                      <StatusBadge
                        color={product.isActive ? 'mint' : 'gray'}
                        label={product.isActive ? 'Activo' : 'Inactivo'}
                      />
                    </Td>
                    <Td>{formatDateTime(product.updatedAt)}</Td>
                    <Td isNumeric>
                      <HStack spacing={1} justify="flex-end">
                        <Button size="xs" variant="ghost" onClick={() => openEdit(product)}>
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          isLoading={busy === `toggle:${product.id}`}
                          onClick={() => void toggleActive(product)}
                        >
                          {product.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={submitForm}>
          <ModalHeader>{editing === null ? 'Nuevo producto' : 'Editar producto'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field
                label="SKU"
                isRequired
                error={errors.sku}
                helper={
                  editing === null
                    ? 'Código interno único en la propiedad. 2 a 32 caracteres.'
                    : 'El SKU no se puede modificar.'
                }
              >
                <Input
                  size="sm"
                  value={form.sku}
                  maxLength={32}
                  isDisabled={editing !== null}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sku: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Nombre" isRequired error={errors.name}>
                <Input
                  size="sm"
                  value={form.name}
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Descripción" error={errors.description}>
                <Textarea
                  size="sm"
                  rows={2}
                  maxLength={400}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </Field>
              <HStack spacing={3} align="flex-start">
                <Field label="Categoría" isRequired>
                  <Select
                    size="sm"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as FolioProductCategory,
                      }))
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {PRODUCT_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Unidad" isRequired error={errors.unit}>
                  <Input
                    size="sm"
                    value={form.unit}
                    maxLength={8}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, unit: event.target.value }))
                    }
                    required
                  />
                </Field>
              </HStack>
              <Field
                label={`Precio (${currency})`}
                isRequired
                error={errors.unitAmount}
                helper="Hasta dos decimales. Ejemplo: 7.50"
              >
                <Input
                  size="sm"
                  inputMode="decimal"
                  value={form.unitAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, unitAmount: event.target.value }))
                  }
                  required
                />
              </Field>
              <Badge colorScheme="sky" alignSelf="flex-start">
                Los cambios de precio no alteran cargos ya registrados.
              </Badge>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={modal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={busy === 'save'}>
              {editing === null ? 'Crear producto' : 'Guardar cambios'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function CatalogPage() {
  return (
    <PropertyGate>
      <CatalogContent />
    </PropertyGate>
  );
}
