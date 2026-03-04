import { Injectable, Inject } from '@nestjs/common';
import { z } from 'zod';
import { FurnitureAnalysis, CatalogVocabulary } from '@kassa-task/common';

const MappingSchema = z.object({
  mappings: z.array(z.object({ original: z.string(), mapped: z.string() })),
});

type LlmClient = { invoke(input: unknown): Promise<z.infer<typeof MappingSchema>> };

@Injectable()
export class VocabularyExpansionService {
  constructor(
    // LangChain Runnable with structured output (Gemini Flash + MappingSchema).
    // Injected as string token so the module factory can swap models without touching this class.
    @Inject('GEMINI_FLASH_LLM')
    private readonly llm: LlmClient,
  ) {}

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
    vocabulary: CatalogVocabulary,
  ): Promise<FurnitureAnalysis> {
    try {
      // Pair each analysis field's value with its corresponding vocabulary list.
      // furniture_type maps to vocabulary.types; empty vocab list → skip (no target terms).
      const fieldVocabs: Array<{ value: string; vocabList: string[] }> = [];
      if (analysis.furniture_type) {
        fieldVocabs.push({ value: analysis.furniture_type.value, vocabList: vocabulary.types });
      }
      if (analysis.category) {
        fieldVocabs.push({ value: analysis.category.value, vocabList: vocabulary.categories });
      }
      for (const s of analysis.style_descriptors) {
        fieldVocabs.push({ value: s.value, vocabList: vocabulary.styles });
      }
      for (const m of analysis.materials) {
        fieldVocabs.push({ value: m.value, vocabList: vocabulary.materials });
      }
      for (const c of analysis.color_palette) {
        fieldVocabs.push({ value: c.value, vocabList: vocabulary.colors });
      }

      // Collect terms whose vocab list is non-empty but don't have a case-insensitive match.
      const nonMatching = fieldVocabs.filter(
        ({ value, vocabList }) =>
          vocabList.length > 0 &&
          !vocabList.some((v) => v.toLowerCase() === value.toLowerCase()),
      );

      // Nothing to map — return original analysis immediately (no LLM call).
      if (nonMatching.length === 0) {
        return analysis;
      }

      const allVocabTerms = [
        ...new Set([
          ...vocabulary.categories,
          ...vocabulary.types,
          ...vocabulary.styles,
          ...vocabulary.materials,
          ...vocabulary.colors,
        ]),
      ];

      const response = await this.llm.invoke({
        terms: nonMatching.map((f) => f.value),
        vocabulary: allVocabTerms,
      });

      const mappingMap = new Map(
        response.mappings.map((m) => [m.original.toLowerCase(), m.mapped]),
      );

      const mapValue = (value: string): string =>
        mappingMap.get(value.toLowerCase()) ?? value;

      return {
        ...analysis,
        furniture_type: analysis.furniture_type
          ? { ...analysis.furniture_type, value: mapValue(analysis.furniture_type.value) }
          : null,
        category: analysis.category
          ? { ...analysis.category, value: mapValue(analysis.category.value) }
          : null,
        style_descriptors: analysis.style_descriptors.map((s) => ({
          ...s,
          value: mapValue(s.value),
        })),
        materials: analysis.materials.map((m) => ({ ...m, value: mapValue(m.value) })),
        color_palette: analysis.color_palette.map((c) => ({ ...c, value: mapValue(c.value) })),
      };
    } catch {
      return analysis;
    }
  }
}
