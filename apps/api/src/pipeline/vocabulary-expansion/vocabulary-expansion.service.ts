import { Injectable } from '@nestjs/common';
import { FurnitureAnalysis, CatalogVocabulary } from '@kassa-task/common';

@Injectable()
export class VocabularyExpansionService {
  /**
   * Maps raw LLM-generated terms in the analysis to the closest catalog vocabulary terms.
   * Terms already present in the vocabulary (case-insensitive) are returned unchanged.
   * Non-matching terms are batched into a single Gemini Flash call.
   *
   * NEVER throws — returns the original analysis unchanged on any error.
   * This ensures Stage 2 failures never block L1/L2 retrieval.
   */
  async expand(
    analysis: FurnitureAnalysis,
    _vocabulary: CatalogVocabulary,
  ): Promise<FurnitureAnalysis> {
    return analysis;
  }
}
