# Technical Specification

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Features](#features)
  - [Product Catalog (Read-Only)](#feature-product-catalog-read-only)
    - [Architecture Decision](#architecture-decision)
    - [Data Models](#data-models)
    - [Atlas Indexes](#atlas-indexes)
    - [API Endpoints](#api-endpoints)
    - [State & Data Flow](#state--data-flow)
    - [Dependencies](#dependencies)
    - [Testing Strategy](#testing-strategy)
    - [Connection Configuration](#connection-configuration)

---

## Architecture Overview

pnpm monorepo with Turborepo. NestJS backend (`apps/api`, port 3001), Next.js frontend (`apps/web`, port 3000), shared types in `packages/common`.

**Zod as single source of truth**: All entity shapes are defined once as Zod schemas in `packages/common`. Downstream consumers derive from them automatically — no duplicate field declarations:
- TypeScript type: `z.infer<typeof schema>`
- NestJS DTO: `createZodDto(schema)` via `nestjs-zod`
- Mongoose Schema: `zodToMongooseSchema(schema)` via local utility

---

## Features

### Feature: Product Catalog (Read-Only)

#### Architecture Decision

The catalog connects to a read-only Atlas MongoDB cluster. The API exposes fetch-only endpoints aligned with the actual collection indexes. No write operations exist anywhere in this module.

Zod schema in `packages/common` is the single definition of the Product shape. The Mongoose schema is derived automatically using a thin local `zodToMongooseSchema()` utility (no decorator-based `@Prop` / `@Schema` classes).

`CatalogModule` is self-contained: it owns the `MongooseModule.forRoot()` connection so `AppModule` has no MongoDB concern. This makes the module portable and testable in isolation.

#### Data Models

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | MongoDB auto-generated |
| `title` | string | Text index (weight 2) |
| `description` | string | Text index (weight 1) |
| `category` | string | Compound index (position 1) |
| `type` | string | Compound index (position 2) |
| `price` | number | USD; compound index (position 3) |
| `width` | number | Centimeters |
| `height` | number | Centimeters |
| `depth` | number | Centimeters |

#### Atlas Indexes

| Name | Key Pattern | Notes |
|---|---|---|
| `_id_` | `{ _id: 1 }` | Standard MongoDB default |
| `title_text_description_text` | text on `title` + `description` | `title` weight 2, `description` weight 1 |
| `category_1_type_1_price_1` | `{ category: 1, type: 1, price: 1 }` | Compound — used for filter endpoint |

#### API Endpoints

##### GET /api/catalog/products
- **Index used**: `category_1_type_1_price_1`
- **Query params**: `category?` (string), `type?` (string), `minPrice?` (number), `maxPrice?` (number)
- **Response**: `200` array of Product documents
- **Errors**: `400` (invalid query param types via ZodValidationPipe)

##### GET /api/catalog/products/search
- **Index used**: `title_text_description_text`
- **Query params**: `q` (string, required), `limit?` (integer 1–100, default 20)
- **Response**: `200` array of Product documents
- **Errors**: `400` (missing or empty `q`)

##### GET /api/catalog/products/:id
- **Index used**: `_id_`
- **Response**: `200` single Product document
- **Errors**: `400` (malformed ObjectId), `404` (not found)

#### State & Data Flow

```
HTTP Request
  → ZodValidationPipe (global, validates query/body against Zod schema)
  → CatalogController (@Query() / @Param())
  → CatalogService (Mongoose query, read-only)
  → MongoDB Atlas (read-only user)
  → ProductDocument (lean plain object)
  → HTTP Response
```

#### Dependencies

| Package | Location | Purpose |
|---|---|---|
| `zod` | `packages/common` | Schema definition language |
| `nestjs-zod` | `apps/api` | Generates NestJS DTOs from Zod schemas |
| `@nestjs/config` | `apps/api` | Loads `.env` files via `ConfigModule` |
| `@nestjs/mongoose` | `apps/api` | Already installed — NestJS Mongoose integration |
| `mongoose` | `apps/api` | Already installed — MongoDB driver |
| `mongodb-memory-server` | `apps/api` (dev) | In-memory MongoDB for unit tests |

#### Testing Strategy

- **Unit tests** (`catalog.service.spec.ts`): `mongodb-memory-server` — seeds 3 real example documents, tests all query paths including edge cases
- **Index validation** (`catalog.indexes.spec.ts`): connects to real Atlas instance, asserts exact indexes match expectations — skipped if `MONGODB_URI` not set

#### Connection Configuration

- Atlas URI stored in `.env` (gitignored), template in `.env.example`
- `autoIndex: false`, `autoCreate: false` — read-only user cannot create indexes or collections
- `MongooseModule.forRoot()` lives inside `CatalogModule`, not `AppModule`

---

### Feature: Navigation, Search Surface, and API Key Handling (F1–F3)

#### Architecture Decision

F1–F3 are pure frontend concerns. The shared domain type (`ProviderKeys`) lives in `packages/common`; all React-specific implementation lives in `apps/web`.

User-supplied API keys are **ephemeral only** — held in React state for the browser session and sent on every request as an HTTP header. They are never written to `localStorage`, `sessionStorage`, or any persistent store. Admin-configured keys are a backend concern (F7) persisted to local MongoDB; the frontend has no involvement in admin key storage.

#### Component Tree

```
RootLayout (app/layout.tsx)          ← server component
  └── ApiKeyProvider (context/)      ← 'use client', React state
        ├── NavBar (components/)     ← 'use client', tabs + key input
        └── {page children}
              └── SearchSurface      ← 'use client', upload + query
```

#### Routing

| Route | Component | Purpose |
|---|---|---|
| `/` | `app/page.tsx` → `SearchSurface` | End-user search |
| `/admin` | `app/admin/page.tsx` | Admin configuration (F7, placeholder) |

#### State & Data Flow

```
User types API key
  → NavBar onChange → setApiKey() → ApiKeyContext state

User submits search form
  → SearchSurface handleSubmit
  → builds FormData { image?, userQuery }
  → apiFetch('/api/match', { body: formData }, apiKey)
      → adds x-gemini-key header if apiKey non-empty
      → fetch()

Backend receives request
  → extracts x-gemini-key per-request
  → resolves ProviderKeys { gemini, openai }
  → never logs or caches keys
```

#### API Key Transport

- Frontend sends `x-gemini-key: <key>` header when a user key is present
- Header is omitted when `apiKey === ''`; backend falls through to admin key
- The `x-openai-key` header is reserved for admin-configured fallback (F7); not sent by the frontend NavBar

#### File Validation (client-side, before upload)

| Rule | Value |
|---|---|
| Accepted MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Max file size | 10 MB (`10 * 1024 * 1024` bytes) |
| Enforcement point | `SearchSurface.handleFile()` — before any state update |

#### Query Bar

- 500-character hard limit enforced on every `onChange` keystroke (`value.slice(0, 500)`)
- Paste handler intercepts oversized paste, truncates, shows visible warning
- Live counter rendered as `{query.length}/500`

#### Key Files

| File | Purpose |
|---|---|
| `packages/common/src/search.schema.ts` | `ProviderKeys` shared domain type |
| `apps/web/types/search.ts` | `SearchFormState` (web-only — uses DOM `File`) |
| `apps/web/context/ApiKeyContext.tsx` | React Context + `useApiKey()` hook |
| `apps/web/lib/apiClient.ts` | Fetch wrapper that injects `x-gemini-key` |
| `apps/web/components/NavBar.tsx` | Tab navigation + API key input |
| `apps/web/components/SearchSurface.tsx` | Image upload + query bar + submit |

#### Dependencies

No new dependencies added. All APIs are natively available:
- Drag-and-drop: HTML5 native drag events
- File validation: `File.type`, `File.size`, `URL.createObjectURL`
- Routing: `next/link`, `next/navigation` — already in Next.js 14
- State: React `useState`, `createContext`, `useContext` — built-in
- Form data: native `FormData`

---
<!-- Add more features following the same structure -->
