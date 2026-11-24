import type { FolioProductCategory } from '@/lib/types';

export const CATEGORIES: FolioProductCategory[] = [
  'MINIBAR',
  'FOOD_BEVERAGE',
  'PARKING',
  'LAUNDRY',
  'SERVICE',
  'OTHER',
];

export const EMPTY_FORM = {
  sku: '',
  name: '',
  description: '',
  category: 'MINIBAR' as FolioProductCategory,
  unit: 'UN',
  unitAmount: '',
};

export type ProductForm = typeof EMPTY_FORM;
