# apps/api/src/catalog

## Rules

- **READ-ONLY** — no create, update, or delete operations. The Atlas user has no write access.
- **Zod schemas live in `packages/common`** — never define entity field shapes here
- **No `@Prop` decorators** — Mongoose schema is generated via `zodToMongooseSchema()` in `utils/`
- **Index-aligned API** — only write queries that use a confirmed Atlas index

## Confirmed Atlas Indexes (products collection)

| Name | Key Pattern | Used by |
|---|---|---|
| `_id_` | `{ _id: 1 }` | `findById()` |
| `title_text_description_text` | text, title w=2, description w=1 | `search()` |
| `category_1_type_1_price_1` | `{ category: 1, type: 1, price: 1 }` | `filter()` |

**Never assume an index exists.** Validate against the real Atlas instance with:

```bash
MONGODB_URI=<atlas-url> pnpm --filter api test --testPathPattern=catalog.indexes
```

## File Structure

```
catalog/
├── CLAUDE.md                          ← this file
├── catalog.module.ts                  ← self-contained; owns MongooseModule.forRoot()
├── catalog.controller.ts              ← HTTP GET handlers (3 routes)
├── catalog.service.ts                 ← Mongoose query methods
├── catalog.service.spec.ts            ← unit tests (mongodb-memory-server)
├── catalog.indexes.spec.ts            ← real Atlas index validation
├── dto/
│   ├── product-filter.dto.ts          ← createZodDto(productFilterSchema)
│   └── product-search.dto.ts          ← createZodDto(productSearchSchema)
├── schemas/
│   └── product.schema.ts              ← zodToMongooseSchema(productZodSchema)
└── utils/
    └── zod-to-mongoose.ts             ← Zod → Mongoose Schema conversion utility
```

## Adding a new query endpoint

1. Check if an Atlas index supports the query pattern
2. Add a Zod query schema to `packages/common` (rebuild common)
3. Create a DTO with `createZodDto(newSchema)`
4. Add a service method and controller route
5. Write tests in `catalog.service.spec.ts`
