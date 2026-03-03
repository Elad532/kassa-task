import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FurnitureAnalysis } from '@kassa-task/common';
import {
  PRODUCT_EMBEDDING_MODEL,
  ProductEmbeddingDocument,
} from './schemas/product-embedding.schema';

export interface PriceRange {
  min?: number;
  max?: number;
}

@Injectable()
export class EmbeddingsService {
  constructor(
    // 'local' must match the connectionName in MirrorModule.forRootAsync.
    // Using the default connection here would silently query Atlas instead.
    @InjectModel(PRODUCT_EMBEDDING_MODEL, 'local')
    private readonly embeddingModel: Model<ProductEmbeddingDocument>,
  ) {}

  /**
   * Returns true when the local mirror has at least one embedding and
   * $vectorSearch is available (i.e. using mongodb-atlas-local image).
   */
  async isReady(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  /**
   * Converts a FurnitureAnalysis to natural-language prose for embedding.
   * Output must NOT contain JSON syntax ({ } "confidence") — it is embedded as-is.
   * Null/empty fields are skipped.
   *
   * L3 calls this with the ORIGINAL unexpanded analysis from Stage 1.
   * It never receives the Stage 2 expanded analysis.
   */
  reconstructProse(analysis: FurnitureAnalysis): string {
    throw new Error('Not implemented');
  }

  /**
   * Runs $vectorSearch on product_embeddings using the analysis prose as query.
   * Returns product_ids in cosine-similarity rank order.
   *
   * @param analysis The ORIGINAL unexpanded analysis from Stage 1 (not Stage 2 output)
   * @param candidateCount Maximum number of results to return
   * @param priceRange Optional price filter applied as $vectorSearch pre-filter
   * @param categoryFilter Optional category string applied as $vectorSearch pre-filter
   */
  async search(
    analysis: FurnitureAnalysis,
    candidateCount: number,
    priceRange?: PriceRange,
    categoryFilter?: string,
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }
}
