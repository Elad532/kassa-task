export interface Dummy {
  id: string
  message: string
}

export {
  productZodSchema,
  productFilterSchema,
  productSearchSchema,
} from './product.schema';

export type {
  Product,
  ProductFilter,
  ProductSearch,
} from './product.schema';
