import { HydratedDocument } from 'mongoose';
import { productZodSchema, Product } from '@kassa-task/common';
import { zodToMongooseSchema } from '../utils/zod-to-mongoose';

export type ProductDocument = HydratedDocument<Product>;

/**
 * Mongoose schema derived automatically from the Zod schema.
 * Do NOT add fields here — add them in packages/common/src/product.schema.ts.
 *
 * autoIndex: false  — read-only Atlas user cannot create indexes
 * autoCreate: false — read-only Atlas user cannot create collections
 */
export const ProductMongooseSchema = zodToMongooseSchema(productZodSchema, {
  collection: 'products',
  autoIndex: false,
  autoCreate: false,
});
