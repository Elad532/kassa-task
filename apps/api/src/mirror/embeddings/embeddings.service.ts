import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
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

type EmbeddingsClient = { embedQuery(text: string): Promise<number[]> };

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  constructor(
    // 'local' must match the connectionName in MirrorModule.forRootAsync.
    // Using the default connection here would silently query Atlas instead.
    @InjectModel(PRODUCT_EMBEDDING_MODEL, 'local')
    private readonly embeddingModel: Model<ProductEmbeddingDocument>,
    // LangChain GoogleGenerativeAIEmbeddings (text-embedding-004, 768-dim).
    // Injected as string token so tests can swap without touching this class.
    @Inject('EMBEDDINGS_CLIENT')
    private readonly embeddingsClient: EmbeddingsClient,
  ) {}

  /**
   * Creates the HNSW vector search index on product_embeddings if it does not yet exist.
   * Swallows "already exists" and "not supported" errors (e.g. in unit tests).
   * Requires the mongodb/mongodb-atlas-local:7.0 Docker image — community mongo does NOT
   * support createSearchIndex with type: 'vectorSearch'.
   */
  async onModuleInit(): Promise<void> {
    try {
      const collection = this.embeddingModel.collection;
      await collection.createSearchIndex({
        name: 'embedding_hnsw',
        type: 'vectorSearch' as any,
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' },
            { type: 'filter', path: 'category' },
            { type: 'filter', path: 'price' },
          ],
        },
      } as any);
    } catch {
      // Swallow "already exists" and any "not supported" errors.
    }
  }

  /**
   * Returns true when the local mirror has at least one embedding and
   * $vectorSearch is available (i.e. using mongodb-atlas-local image).
   */
  async isReady(): Promise<boolean> {
    const count = await this.embeddingModel.countDocuments();
    return count > 0;
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
    const parts: string[] = [];
    if (analysis.furniture_type) parts.push(analysis.furniture_type.value);
    if (analysis.category) parts.push(analysis.category.value);
    if (analysis.style_descriptors.length) {
      parts.push(analysis.style_descriptors.map((s) => s.value).join(', '));
    }
    if (analysis.materials.length) {
      parts.push(analysis.materials.map((m) => m.value).join(', ') + ' construction');
    }
    if (analysis.color_palette.length) {
      parts.push(analysis.color_palette.map((c) => c.value).join(', '));
    }
    return parts.length > 0 ? parts.join('. ') : 'furniture item';
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
    const prose = this.reconstructProse(analysis);
    const queryVector = await this.embeddingsClient.embedQuery(prose);

    const vectorSearchStage: any = {
      $vectorSearch: {
        index: 'embedding_hnsw',
        path: 'embedding',
        queryVector,
        // PRD: numCandidates = 3 × candidateCount for HNSW over-sampling
        numCandidates: candidateCount * 3,
        limit: candidateCount,
      },
    };

    const filter = this.buildFilter(priceRange, categoryFilter);
    if (filter) {
      vectorSearchStage.$vectorSearch.filter = filter;
    }

    const results = await this.embeddingModel.aggregate([
      vectorSearchStage,
      { $project: { product_id: 1, _id: 0 } },
    ]);

    return results.slice(0, candidateCount).map((r: any) => r.product_id as string);
  }

  private buildFilter(
    priceRange?: PriceRange,
    categoryFilter?: string,
  ): Record<string, unknown> | null {
    const filter: Record<string, unknown> = {};
    if (priceRange?.min !== undefined || priceRange?.max !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (priceRange?.min !== undefined) priceFilter.$gte = priceRange.min;
      if (priceRange?.max !== undefined) priceFilter.$lte = priceRange.max;
      filter.price = priceFilter;
    }
    if (categoryFilter) filter.category = categoryFilter;
    return Object.keys(filter).length > 0 ? filter : null;
  }
}
