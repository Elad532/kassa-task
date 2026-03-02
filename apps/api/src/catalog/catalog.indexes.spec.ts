/**
 * Atlas Index Validation
 *
 * Connects to the real MongoDB Atlas instance and asserts that the actual
 * indexes on the `products` collection match the assumptions this module
 * was built against.
 *
 * Run with: MONGODB_URI=<atlas-url> pnpm --filter api test
 * Skipped automatically when MONGODB_URI is not set (e.g. in CI).
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const SKIP = !MONGODB_URI;

describe('Atlas: products collection index validation', () => {
  let connection: mongoose.Connection;

  beforeAll(async () => {
    if (SKIP) return;
    await mongoose.connect(MONGODB_URI as string);
    connection = mongoose.connection;
  });

  afterAll(async () => {
    if (SKIP) return;
    await mongoose.disconnect();
  });

  it('skips gracefully when MONGODB_URI is not set', () => {
    if (!SKIP) return;
    expect(true).toBe(true); // intentional no-op
  });

  it('has the standard _id index', async () => {
    if (SKIP) return;
    const indexes = await connection.collection('products').indexes();
    const idx = indexes.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ _id: 1 }),
    );
    expect(idx).toBeDefined();
  });

  it('has the compound index on category / type / price', async () => {
    if (SKIP) return;
    const indexes = await connection.collection('products').indexes();
    const idx = indexes.find((i) => i.name === 'category_1_type_1_price_1');
    expect(idx).toBeDefined();
    expect(idx?.key).toEqual({ category: 1, type: 1, price: 1 });
  });

  it('has the text index on title (weight 2) and description (weight 1)', async () => {
    if (SKIP) return;
    const indexes = await connection.collection('products').indexes();
    const idx = indexes.find((i) => i.name === 'title_text_description_text');
    expect(idx).toBeDefined();
    expect(idx?.weights).toEqual({ title: 2, description: 1 });
    expect(idx?.default_language).toBe('english');
  });

  it('has exactly 3 indexes — no unexpected indexes exist', async () => {
    if (SKIP) return;
    const indexes = await connection.collection('products').indexes();
    expect(indexes).toHaveLength(3);
  });
});
