import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { CatalogService, PRODUCT_MODEL } from './catalog.service';
import { ProductMongooseSchema } from './schemas/product.schema';

// Seed data taken from the real Atlas collection
const seedData = [
  {
    title: 'Mid-Century Mahogany Corner Wardrobe',
    description:
      'Espresso mid-century corner wardrobe made from premium mahogany. This wardrobe piece is featuring easy-to-assemble construction. Perfect for adding character to your home.',
    category: 'Wardrobes',
    type: 'Corner Wardrobe',
    price: 1409.99,
    width: 130,
    height: 216,
    depth: 100,
  },
  {
    title: 'Mid-Century Linen Garden Bench',
    description:
      'White mid-century garden bench made from premium linen. This benche piece is with hidden storage compartments. Perfect for adding character to your home.',
    category: 'Benches',
    type: 'Garden Bench',
    price: 609.99,
    width: 160,
    height: 90,
    depth: 58,
  },
  {
    title: 'Scandinavian Metal Storage Cabinet',
    description:
      'Espresso scandinavian storage cabinet made from premium metal. This cabinet piece is featuring easy-to-assemble construction. Perfect for adding character to your home.',
    category: 'Cabinets',
    type: 'Storage Cabinet',
    price: 619.99,
    width: 81,
    height: 86,
    depth: 39,
  },
];

describe('CatalogService', () => {
  let service: CatalogService;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: PRODUCT_MODEL, schema: ProductMongooseSchema },
        ]),
      ],
      providers: [CatalogService],
    }).compile();

    service = module.get<CatalogService>(CatalogService);

    // Seed data — insert directly via model
    const Model = module.get<mongoose.Model<any>>(`${PRODUCT_MODEL}Model`);
    await Model.insertMany(seedData);

    // Text index does not exist in mongodb-memory-server by default.
    // Create it so search() tests work correctly.
    await Model.collection.createIndex(
      { title: 'text', description: 'text' },
      { weights: { title: 2, description: 1 }, name: 'title_text_description_text' },
    );
  });

  afterAll(async () => {
    await module.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  // ─── filter() ────────────────────────────────────────────────────────────

  describe('filter()', () => {
    it('returns all products when no filters are applied', async () => {
      const results = await service.filter({});
      expect(results).toHaveLength(3);
    });

    it('filters by category', async () => {
      const results = await service.filter({ category: 'Wardrobes' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Mid-Century Mahogany Corner Wardrobe');
    });

    it('filters by category and type', async () => {
      const results = await service.filter({ category: 'Benches', type: 'Garden Bench' });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Benches');
    });

    it('filters by price range (minPrice and maxPrice)', async () => {
      const results = await service.filter({ minPrice: 600, maxPrice: 700 });
      expect(results).toHaveLength(2); // bench (609.99) + cabinet (619.99)
      const prices = results.map((r) => r.price).sort();
      expect(prices).toEqual([609.99, 619.99]);
    });

    it('filters by minPrice only', async () => {
      const results = await service.filter({ minPrice: 1000 });
      expect(results).toHaveLength(1);
      expect(results[0].price).toBe(1409.99);
    });

    it('returns empty array for non-existent category', async () => {
      const results = await service.filter({ category: 'Nonexistent' });
      expect(results).toEqual([]);
    });
  });

  // ─── search() ────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('finds wardrobe by title keyword "mahogany"', async () => {
      const results = await service.search({ q: 'mahogany', limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Mahogany');
    });

    it('finds cabinet by title keyword "scandinavian"', async () => {
      const results = await service.search({ q: 'scandinavian', limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Cabinets');
    });

    it('finds all products by description keyword "premium"', async () => {
      const results = await service.search({ q: 'premium', limit: 20 });
      expect(results).toHaveLength(3);
    });

    it('returns empty array for unmatched search term', async () => {
      const results = await service.search({ q: 'notarealwordxyz', limit: 20 });
      expect(results).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const results = await service.search({ q: 'premium', limit: 1 });
      expect(results).toHaveLength(1);
    });
  });

  // ─── findById() ──────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the correct product by id', async () => {
      const all = await service.filter({});
      const id = (all[0] as any)._id.toString();
      const found = await service.findById(id);
      expect(found._id.toString()).toBe(id);
      expect(found.title).toBe(all[0].title);
    });

    it('throws NotFoundException for valid ObjectId that does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(service.findById(fakeId)).rejects.toThrow('Product not found');
    });

    it('throws BadRequestException for malformed id', async () => {
      await expect(service.findById('not-an-objectid')).rejects.toThrow(
        'Invalid product id',
      );
    });
  });
});
