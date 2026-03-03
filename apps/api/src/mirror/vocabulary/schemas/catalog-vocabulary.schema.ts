import { Schema, Document } from 'mongoose';
import { CatalogVocabulary } from '@kassa-task/common';

// Manual Mongoose schema — NOT derived from zodToMongooseSchema.
// Reason: _id must be the plain string 'singleton', not an ObjectId.
// The Zod schema (CatalogVocabularySchema) intentionally omits _id to stay
// clean of Mongoose internals. The override lives here and nowhere else.
export type CatalogVocabularyDocument = CatalogVocabulary & Document & { _id: string };

export const CatalogVocabularyMongooseSchema = new Schema<CatalogVocabularyDocument>(
  {
    _id:         { type: String },
    categories:  { type: [String], required: true },
    types:       { type: [String], required: true },
    styles:      { type: [String], required: true },
    materials:   { type: [String], required: true },
    colors:      { type: [String], required: true },
    refreshedAt: { type: Date,     required: true },
  },
  { collection: 'catalog_vocabulary' },
);

export const CATALOG_VOCABULARY_MODEL = 'CatalogVocabulary';
