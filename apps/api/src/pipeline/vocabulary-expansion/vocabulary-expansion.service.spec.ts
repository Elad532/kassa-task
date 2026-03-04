import { Test, TestingModule } from '@nestjs/testing';
import { VocabularyExpansionService } from './vocabulary-expansion.service';
import {
  FurnitureAnalysis,
  FurnitureAnalysisSchema,
  CatalogVocabulary,
} from '@kassa-task/common';

const baseAnalysis: FurnitureAnalysis = {
  furniture_type: { value: 'Sofa', confidence: 8, reasoning: 'clearly a sofa' },
  category: { value: 'armoire', confidence: 7, reasoning: 'wardrobe-like' },
  style_descriptors: [{ value: 'Scandinavian', confidence: 7, reasoning: '' }],
  materials: [{ value: 'wood', confidence: 8, reasoning: '' }],
  color_palette: [{ value: 'espresso', confidence: 7, reasoning: '' }],
  dimensions: null,
  price_range: null,
  overall: { confidence: 8, reasoning: 'solid match' },
};

const vocabulary: CatalogVocabulary = {
  categories: ['Wardrobes', 'Sofas'],
  types: [],
  styles: ['Scandinavian'],
  materials: ['Wood'],
  colors: ['Espresso'],
  refreshedAt: new Date(),
};

describe('VocabularyExpansionService', () => {
  let service: VocabularyExpansionService;
  let module: TestingModule;

  const mockLlm = { invoke: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        VocabularyExpansionService,
        { provide: 'GEMINI_FLASH_LLM', useValue: mockLlm },
      ],
    }).compile();

    service = module.get<VocabularyExpansionService>(VocabularyExpansionService);
  });

  afterEach(async () => {
    await module.close();
  });

  // ─── expand() ───────────────────────────────────────────────────────────────

  describe('expand()', () => {
    it('output passes FurnitureAnalysisSchema.safeParse', async () => {
      // Arrange: LLM returns a mapping for 'armoire' → 'Wardrobes'
      mockLlm.invoke.mockResolvedValue({
        mappings: [{ original: 'armoire', mapped: 'Wardrobes' }],
      });

      // Act
      const result = await service.expand(baseAnalysis, vocabulary);

      // Assert: result shape is a valid FurnitureAnalysis
      const parsed = FurnitureAnalysisSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('maps non-matching term to catalog term via LLM', async () => {
      // Arrange: 'armoire' is not in vocabulary.categories; LLM maps it to 'Wardrobes'
      mockLlm.invoke.mockResolvedValue({
        mappings: [{ original: 'armoire', mapped: 'Wardrobes' }],
      });

      // Act
      const result = await service.expand(baseAnalysis, vocabulary);

      // Assert: category.value is remapped to the catalog term
      expect(result.category?.value).toBe('Wardrobes');
    });

    it('returns original analysis unchanged when LLM throws', async () => {
      // Arrange: LLM failure
      mockLlm.invoke.mockRejectedValue(new Error('LLM error'));

      // Act
      const result = await service.expand(baseAnalysis, vocabulary);

      // Assert: must not throw; returns the input analysis unchanged
      expect(result).toEqual(baseAnalysis);
    });

    it('does NOT call LLM when term already matches vocab case-insensitively', async () => {
      // Arrange: category.value = 'Wardrobes' already exists in vocabulary.categories
      const analysisWithMatch: FurnitureAnalysis = {
        ...baseAnalysis,
        category: { value: 'Wardrobes', confidence: 7, reasoning: 'already in vocab' },
      };

      // Act
      await service.expand(analysisWithMatch, vocabulary);

      // Assert: LLM is never called when all terms match
      expect(mockLlm.invoke).not.toHaveBeenCalled();
    });

    it('returns original analysis unchanged when vocabulary is empty', async () => {
      // Arrange: empty vocab — no terms to map to
      const emptyVocab: CatalogVocabulary = {
        categories: [],
        types: [],
        styles: [],
        materials: [],
        colors: [],
        refreshedAt: new Date(),
      };

      // Act
      const result = await service.expand(baseAnalysis, emptyVocab);

      // Assert: nothing to map, analysis is returned as-is
      expect(result).toEqual(baseAnalysis);
    });

    it('preserves the overall field unchanged', async () => {
      // Arrange: LLM maps 'armoire' → 'Wardrobes'
      mockLlm.invoke.mockResolvedValue({
        mappings: [{ original: 'armoire', mapped: 'Wardrobes' }],
      });

      // Act
      const result = await service.expand(baseAnalysis, vocabulary);

      // Assert: overall must be identical to input
      expect(result.overall).toEqual(baseAnalysis.overall);
    });
  });
});
