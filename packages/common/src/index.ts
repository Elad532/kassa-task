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

export type { ProviderKeys } from './search.schema';

export {
  ReasonedSchema,
  StringAttributeSchema,
  DimensionsAttributeSchema,
  PriceRangeAttributeSchema,
  FurnitureAnalysisSchema,
  GuardrailResponseSchema,
} from './analysis.schema';

export type {
  Reasoned,
  StringAttribute,
  DimensionsAttribute,
  PriceRangeAttribute,
  FurnitureAnalysis,
  GuardrailResponse,
} from './analysis.schema';

export {
  CatalogVocabularySchema,
  ProductEmbeddingSchema,
} from './vocabulary.schema';

export type {
  CatalogVocabulary,
  ProductEmbedding,
} from './vocabulary.schema';
