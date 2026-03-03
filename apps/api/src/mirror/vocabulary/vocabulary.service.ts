import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CatalogVocabulary } from '@kassa-task/common';
import {
  CATALOG_VOCABULARY_MODEL,
  CatalogVocabularyDocument,
} from './schemas/catalog-vocabulary.schema';

@Injectable()
export class VocabularyService {
  constructor(
    // 'local' must match the connectionName in MirrorModule.forRootAsync.
    // Using the default connection here would silently query Atlas instead.
    @InjectModel(CATALOG_VOCABULARY_MODEL, 'local')
    private readonly vocabularyModel: Model<CatalogVocabularyDocument>,
  ) {}

  /**
   * Returns the current catalog vocabulary, refreshing if absent or stale.
   * @param maxAgeMs Maximum age in milliseconds before a refresh is triggered (default 24 h)
   */
  async getVocabulary(_maxAgeMs?: number): Promise<CatalogVocabulary> {
    return this.stubVocabulary();
  }

  /**
   * Re-extracts vocabulary from Atlas and upserts the singleton document.
   * @param sampleSize Number of product documents to sample for style/material/color extraction
   */
  async refresh(_sampleSize?: number): Promise<CatalogVocabulary> {
    return this.stubVocabulary();
  }

  private stubVocabulary(): CatalogVocabulary {
    return {
      categories: [],
      types: [],
      styles: [],
      materials: [],
      colors: [],
      refreshedAt: new Date(0),
    };
  }
}
