'use client';

import {
  Button,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { QueryFeedback, StatusBadge } from '@/components/ui';
import {
  formatDateTime,
  formatMoney,
  productCategoryLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FolioProduct } from '@/lib/types';

export function CatalogTable({
  items,
  loading,
  error,
  onRetry,
  busy,
  onEdit,
  onToggle,
}: {
  items: FolioProduct[];
  loading: boolean;
  error: unknown | null;
  onRetry: () => void;
  busy: string | null;
  onEdit: (product: FolioProduct) => void;
  onToggle: (product: FolioProduct) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <QueryFeedback
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyText={t('catalog.empty')}
    >
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th>{t('catalog.table.name')}</Th>
              <Th>{t('catalog.table.category')}</Th>
              <Th>{t('catalog.table.unit')}</Th>
              <Th isNumeric>{t('catalog.table.price')}</Th>
              <Th>{t('catalog.table.status')}</Th>
              <Th>{t('catalog.table.updatedAt')}</Th>
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
                <Td>{productCategoryLabel(locale, product.category)}</Td>
                <Td>{product.unit}</Td>
                <Td isNumeric>{formatMoney(product.unitAmount, product.currencyCode)}</Td>
                <Td>
                  <StatusBadge
                    color={product.isActive ? 'mint' : 'gray'}
                    label={
                      product.isActive
                        ? t('catalog.product.active')
                        : t('catalog.product.inactive')
                    }
                  />
                </Td>
                <Td>{formatDateTime(product.updatedAt)}</Td>
                <Td isNumeric>
                  <HStack spacing={1} justify="flex-end">
                    <Button size="xs" variant="ghost" onClick={() => onEdit(product)}>
                      {t('catalog.edit')}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      isLoading={busy === `toggle:${product.id}`}
                      onClick={() => onToggle(product)}
                    >
                      {product.isActive ? t('catalog.deactivate') : t('catalog.activate')}
                    </Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </QueryFeedback>
  );
}
