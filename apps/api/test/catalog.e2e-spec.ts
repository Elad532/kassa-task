import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZodValidationPipe } from 'nestjs-zod';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import mongoose from 'mongoose';
import { CatalogController } from '../src/catalog/catalog.controller';
import { CatalogService, PRODUCT_MODEL } from '../src/catalog/catalog.service';
import { ProductMongooseSchema } from '../src/catalog/schemas/product.schema';

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

describe('CatalogController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let seededIds: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: PRODUCT_MODEL, schema: ProductMongooseSchema },
        ]),
      ],
      controllers: [CatalogController],
      providers: [CatalogService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    // Seed and create text index (autoIndex: false on schema, so explicit creation required)
    const Model = module.get<mongoose.Model<any>>(`${PRODUCT_MODEL}Model`);
    const inserted = await Model.insertMany(seedData);
    seededIds = inserted.map((doc: any) => doc._id.toString());

    await Model.collection.createIndex(
      { title: 'text', description: 'text' },
      { weights: { title: 2, description: 1 }, name: 'title_text_description_text' },
    );
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  // ─── GET /api/catalog/products ────────────────────────────────────────────

  describe('GET /api/catalog/products', () => {
    it('returns all products when no query params are given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products')
        .expect(200);

      expect(res.body).toHaveLength(3);
    });

    it('filters by category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products?category=Wardrobes')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Mid-Century Mahogany Corner Wardrobe');
    });

    it('filters by category and type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products?category=Benches&type=Garden+Bench')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].category).toBe('Benches');
    });

    it('filters by price range', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products?minPrice=600&maxPrice=700')
        .expect(200);

      expect(res.body).toHaveLength(2);
      const prices = res.body.map((p: any) => p.price).sort();
      expect(prices).toEqual([609.99, 619.99]);
    });

    it('returns 400 when minPrice is not a number', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/products?minPrice=notanumber')
        .expect(400);
    });

    it('returns empty array for non-existent category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products?category=Nonexistent')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/catalog/products/search ────────────────────────────────────

  describe('GET /api/catalog/products/search', () => {
    it('finds product by keyword in title', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/search?q=mahogany')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toContain('Mahogany');
    });

    it('finds all products matching a shared description keyword', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/search?q=premium')
        .expect(200);

      expect(res.body).toHaveLength(3);
    });

    it('respects the limit param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/search?q=premium&limit=1')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('returns 400 when q is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/products/search')
        .expect(400);
    });

    it('returns 400 when limit is out of range', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/products/search?q=mahogany&limit=999')
        .expect(400);
    });

    it('returns empty array for unmatched search term', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/search?q=notarealwordxyz')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    // Guard: 'search' route must not be swallowed by ':id' route
    it('is not treated as a product id (routing order guard)', async () => {
      // If routing is wrong this would return 400 (invalid ObjectId) instead of 400 (missing q)
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/search')
        .expect(400);

      expect(res.body.message).not.toMatch(/Invalid product id/);
    });
  });

  // ─── GET /api/catalog/products/:id ───────────────────────────────────────

  describe('GET /api/catalog/products/:id', () => {
    it('returns the correct product by id', async () => {
      const id = seededIds[0];
      const res = await request(app.getHttpServer())
        .get(`/api/catalog/products/${id}`)
        .expect(200);

      expect(res.body._id).toBe(id);
      expect(res.body.title).toBe(seedData[0].title);
    });

    it('returns product with all expected fields', async () => {
      const id = seededIds[0];
      const res = await request(app.getHttpServer())
        .get(`/api/catalog/products/${id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        type: expect.any(String),
        price: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        depth: expect.any(Number),
      });
    });

    it('returns 404 for a valid ObjectId that does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app.getHttpServer())
        .get(`/api/catalog/products/${fakeId}`)
        .expect(404);

      expect(res.body.message).toBe('Product not found');
    });

    it('returns 400 for a malformed id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/products/not-an-objectid')
        .expect(400);

      expect(res.body.message).toMatch(/Invalid product id/);
    });
  });
});
