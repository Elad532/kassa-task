import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CatalogVocabulary } from '@kassa-task/common';
import {
  CATALOG_VOCABULARY_MODEL,
  CatalogVocabularyDocument,
} from './schemas/catalog-vocabulary.schema';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class VocabularyService {
  constructor(
    // 'local' must match the connectionName in MirrorModule.forRootAsync.
    // Using the default connection here would silently query Atlas instead.
    @InjectModel(CATALOG_VOCABULARY_MODEL, 'local')
    private readonly vocabularyModel: Model<CatalogVocabularyDocument>,
    // Atlas products model — default connection (no connectionName arg).
    // Used by refresh() to query distinct catalog terms from the live Atlas collection.
    @InjectModel('Product')
    private readonly productsModel: Model<any>,
  ) {}

  /**
   * Returns the current catalog vocabulary, refreshing if absent or stale.
   * @param maxAgeMs Maximum age in milliseconds before a refresh is triggered (default 24 h)
   */
  async getVocabulary(maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<CatalogVocabulary> {
    const doc = await this.vocabularyModel.findById('singleton');
    if (!doc) {
      return this.refresh();
    }
    const age = Date.now() - new Date(doc.refreshedAt).getTime();
    if (age > maxAgeMs) {
      return this.refresh();
    }
    const { categories, types, styles, materials, colors, refreshedAt } = doc;
    return { categories, types, styles, materials, colors, refreshedAt };
  }

  /**
   * Re-extracts vocabulary from Atlas and upserts the singleton document.
   * Queries distinct category and type values from the Atlas products collection.
   * @param _sampleSize Reserved for future style/material/color sampling (unused in this version)
   */
  async refresh(_sampleSize?: number): Promise<CatalogVocabulary> {
    const [categories, types] = await Promise.all([
      this.productsModel.distinct('category'),
      this.productsModel.distinct('type'),
    ]);

    const vocab: CatalogVocabulary = {
      categories,
      types,
      styles: [],
      materials: [],
      colors: [],
      refreshedAt: new Date(),
    };

    await this.vocabularyModel.findByIdAndUpdate('singleton', vocab, {
      upsert: true,
      new: true,
    });

    return vocab;
  }
}
