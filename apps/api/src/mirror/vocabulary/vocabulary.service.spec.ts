import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VocabularyService } from './vocabulary.service';
import { CATALOG_VOCABULARY_MODEL } from './schemas/catalog-vocabulary.schema';
import { CatalogVocabularySchema } from '@kassa-task/common';

describe('VocabularyService', () => {
  let service: VocabularyService;
  let module: TestingModule;

  const mockVocabModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockProductsModel = {
    distinct: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        VocabularyService,
        {
          provide: getModelToken(CATALOG_VOCABULARY_MODEL, 'local'),
          useValue: mockVocabModel,
        },
        {
          provide: getModelToken('Product'),
          useValue: mockProductsModel,
        },
      ],
    }).compile();

    service = module.get<VocabularyService>(VocabularyService);
  });

  afterEach(async () => {
    await module.close();
  });

  // ─── getVocabulary() ────────────────────────────────────────────────────────

  describe('getVocabulary()', () => {
    it('returns a value that passes CatalogVocabularySchema.safeParse', async () => {
      // Arrange: vocab document is present and fresh (refreshedAt = now)
      const freshDoc = {
        categories: ['Wardrobes', 'Sofas'],
        types: ['Corner Wardrobe'],
        styles: ['Scandinavian'],
        materials: ['Wood'],
        colors: ['Espresso'],
        refreshedAt: new Date(),
      };
      mockVocabModel.findById.mockResolvedValue(freshDoc);

      // Act
      const result = await service.getVocabulary();

      // Assert: shape must be valid per the shared Zod schema
      const parsed = CatalogVocabularySchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('calls refresh() when local MongoDB has no vocabulary document', async () => {
      // Arrange: no document stored yet
      mockVocabModel.findById.mockResolvedValue(null);
      const refreshSpy = jest.spyOn(service, 'refresh').mockResolvedValue({
        categories: [],
        types: [],
        styles: [],
        materials: [],
        colors: [],
        refreshedAt: new Date(),
      });

      // Act
      await service.getVocabulary();

      // Assert
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('calls refresh() when vocabulary is stale (refreshedAt older than maxAgeMs)', async () => {
      // Arrange: document is 2 days old; maxAgeMs = 1 day
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const staleDoc = {
        categories: [],
        types: [],
        styles: [],
        materials: [],
        colors: [],
        refreshedAt: twoDaysAgo,
      };
      mockVocabModel.findById.mockResolvedValue(staleDoc);
      const refreshSpy = jest.spyOn(service, 'refresh').mockResolvedValue({
        ...staleDoc,
        refreshedAt: new Date(),
      });
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Act
      await service.getVocabulary(oneDayMs);

      // Assert
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT call refresh() when vocabulary is fresh (refreshedAt within maxAgeMs)', async () => {
      // Arrange: document is 1 hour old; maxAgeMs = 24 hours
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const freshDoc = {
        categories: ['Wardrobes'],
        types: [],
        styles: [],
        materials: [],
        colors: [],
        refreshedAt: oneHourAgo,
      };
      mockVocabModel.findById.mockResolvedValue(freshDoc);
      const refreshSpy = jest.spyOn(service, 'refresh');
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Act
      await service.getVocabulary(oneDayMs);

      // Assert
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  // ─── refresh() ──────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    beforeEach(() => {
      // Default Atlas responses
      mockProductsModel.distinct.mockImplementation((field: string) => {
        if (field === 'category') return Promise.resolve(['Wardrobes', 'Sofas']);
        if (field === 'type') return Promise.resolve(['Corner Wardrobe', 'Loveseat']);
        return Promise.resolve([]);
      });
      mockVocabModel.findByIdAndUpdate.mockResolvedValue({
        categories: ['Wardrobes', 'Sofas'],
        types: ['Corner Wardrobe', 'Loveseat'],
        styles: [],
        materials: [],
        colors: [],
        refreshedAt: new Date(),
      });
    });

    it('calls findByIdAndUpdate with "singleton" as _id and upsert+new options', async () => {
      // Act
      await service.refresh();

      // Assert: must upsert the singleton document
      expect(mockVocabModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'singleton',
        expect.anything(),
        expect.objectContaining({ upsert: true, new: true }),
      );
    });

    it('queries Atlas distinct("category") on the products model', async () => {
      // Act
      await service.refresh();

      // Assert
      expect(mockProductsModel.distinct).toHaveBeenCalledWith('category');
    });

    it('queries Atlas distinct("type") on the products model', async () => {
      // Act
      await service.refresh();

      // Assert
      expect(mockProductsModel.distinct).toHaveBeenCalledWith('type');
    });
  });
});
