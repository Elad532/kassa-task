import { Schema, Document } from 'mongoose';
import { ProductEmbedding } from '@kassa-task/common';

// Manual Mongoose schema — zodToMongooseSchema does not yet handle mixed-type arrays
// (z.array(z.number()) for the 768-dim embedding vector).
// TODO: refactor to zodToMongooseSchema once it gains mixed-array support.
export type ProductEmbeddingDocument = ProductEmbedding & Document;

export const ProductEmbeddingMongooseSchema = new Schema<ProductEmbeddingDocument>(
  {
    product_id:    { type: String, required: true },
    category:      { type: String, required: true },
    type:          { type: String, required: true },
    price:         { type: Number, required: true },
    // 768-dim vectors from Gemini text-embedding-004. Mixing models invalidates cosine similarity.
    embedding:     { type: [Number], required: true },
    embedded_text: { type: String,   required: true },
    created_at:    { type: Date,     required: true },
    updated_at:    { type: Date,     required: true },
  },
  { collection: 'product_embeddings' },
);

// Compound index for pre-filter in $vectorSearch aggregation
ProductEmbeddingMongooseSchema.index({ category: 1, price: 1 });

export const PRODUCT_EMBEDDING_MODEL = 'ProductEmbedding';
