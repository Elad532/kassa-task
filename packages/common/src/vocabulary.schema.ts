import { z } from 'zod';

export const CatalogVocabularySchema = z.object({
  categories:  z.array(z.string()),
  types:       z.array(z.string()),
  styles:      z.array(z.string()),
  materials:   z.array(z.string()),
  colors:      z.array(z.string()),
  refreshedAt: z.date(),
});

// _id is intentionally absent — Mongoose adds it.
// catalog_vocabulary overrides _id to String at the Mongoose schema level
// (keeps Zod clean of Mongoose internals — see catalog-vocabulary.schema.ts).
export const ProductEmbeddingSchema = z.object({
  product_id:    z.string(),
  category:      z.string(),
  type:          z.string(),
  price:         z.number(),
  // 768-dim vectors from Gemini text-embedding-004 ONLY.
  // Mixing models invalidates cosine similarity — re-embed the entire collection if the model changes.
  embedding:     z.array(z.number()),
  embedded_text: z.string(),
  created_at:    z.date(),
  updated_at:    z.date(),
});

export type CatalogVocabulary = z.infer<typeof CatalogVocabularySchema>;
export type ProductEmbedding = z.infer<typeof ProductEmbeddingSchema>;
