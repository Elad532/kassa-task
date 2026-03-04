import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EmbeddingsService } from './embeddings.service';
import { PRODUCT_EMBEDDING_MODEL } from './schemas/product-embedding.schema';
import { FurnitureAnalysis } from '@kassa-task/common';

// Minimal valid FurnitureAnalysis — all nullable fields set to null, arrays empty
const minimalAnalysis: FurnitureAnalysis = {
  furniture_type: null,
  category: null,
  style_descriptors: [],
  materials: [],
  color_palette: [],
  dimensions: null,
  price_range: null,
  overall: { confidence: 5, reasoning: 'ok' },
};

// Rich analysis used for prose and search tests
const richAnalysis: FurnitureAnalysis = {
  furniture_type: { value: 'Sofa', confidence: 8, reasoning: 'clearly a sofa' },
  category: { value: 'Sofas', confidence: 8, reasoning: 'matches catalog' },
  style_descriptors: [{ value: 'Scandinavian', confidence: 7, reasoning: '' }],
  materials: [{ value: 'Linen', confidence: 8, reasoning: '' }],
  color_palette: [{ value: 'Beige', confidence: 7, reasoning: '' }],
  dimensions: null,
  price_range: { price_start: 500, price_end: 1500, confidence: 6, reasoning: 'estimate' },
  overall: { confidence: 8, reasoning: 'solid match' },
};

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let module: TestingModule;

  const mockEmbeddingModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockEmbeddingsClient = {
    embedQuery: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: getModelToken(PRODUCT_EMBEDDING_MODEL, 'local'),
          useValue: mockEmbeddingModel,
        },
        {
          provide: 'EMBEDDINGS_CLIENT',
          useValue: mockEmbeddingsClient,
        },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);

    // Default embedQuery returns a 768-dim vector
    mockEmbeddingsClient.embedQuery.mockResolvedValue(Array(768).fill(0.1));
  });

  afterEach(async () => {
    await module.close();
  });

  // ─── reconstructProse() ─────────────────────────────────────────────────────

  describe('reconstructProse()', () => {
    it('returns a non-empty string', () => {
      const prose = service.reconstructProse(richAnalysis);
      expect(typeof prose).toBe('string');
      expect(prose.length).toBeGreaterThan(0);
    });

    it('contains the furniture_type value when furniture_type is non-null', () => {
      const prose = service.reconstructProse(richAnalysis);
      // richAnalysis.furniture_type.value === 'Sofa'
      expect(prose).toContain('Sofa');
    });

    it('does NOT contain JSON syntax characters or the word "confidence"', () => {
      const prose = service.reconstructProse(richAnalysis);
      expect(prose).not.toContain('{');
      expect(prose).not.toContain('}');
      expect(prose).not.toContain('"confidence"');
    });

    it('returns a non-empty string even when all fields are null/empty (minimalAnalysis)', () => {
      const prose = service.reconstructProse(minimalAnalysis);
      expect(typeof prose).toBe('string');
      expect(prose.length).toBeGreaterThan(0);
    });
  });

  // ─── isReady() ──────────────────────────────────────────────────────────────

  describe('isReady()', () => {
    it('returns false when collection has 0 documents', async () => {
      mockEmbeddingModel.countDocuments.mockResolvedValue(0);

      const result = await service.isReady();

      expect(result).toBe(false);
    });

    it('returns true when collection has at least 1 embedding', async () => {
      mockEmbeddingModel.countDocuments.mockResolvedValue(1);

      const result = await service.isReady();

      expect(result).toBe(true);
    });
  });

  // ─── search() ───────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns [] when aggregation returns no results', async () => {
      mockEmbeddingModel.aggregate.mockResolvedValue([]);

      const result = await service.search(richAnalysis, 10);

      expect(result).toEqual([]);
    });

    it('returns product_ids in the same order as aggregation results', async () => {
      mockEmbeddingModel.aggregate.mockResolvedValue([
        { product_id: 'p1' },
        { product_id: 'p2' },
      ]);

      const result = await service.search(richAnalysis, 10);

      expect(result).toEqual(['p1', 'p2']);
    });

    it('passes a price pre-filter into the $vectorSearch stage when priceRange is provided', async () => {
      mockEmbeddingModel.aggregate.mockResolvedValue([]);

      await service.search(richAnalysis, 10, { min: 500, max: 1500 });

      // The aggregate pipeline must have been called with a stage referencing price
      expect(mockEmbeddingModel.aggregate).toHaveBeenCalledTimes(1);
      const pipeline = mockEmbeddingModel.aggregate.mock.calls[0][0];
      const pipelineStr = JSON.stringify(pipeline);
      expect(pipelineStr).toContain('price');
    });

    it('returns at most candidateCount results', async () => {
      // Aggregate returns 5 results; candidateCount = 3
      mockEmbeddingModel.aggregate.mockResolvedValue([
        { product_id: 'p1' },
        { product_id: 'p2' },
        { product_id: 'p3' },
        { product_id: 'p4' },
        { product_id: 'p5' },
      ]);

      const result = await service.search(richAnalysis, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });
  });
});
