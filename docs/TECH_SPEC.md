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
  - [Navigation, Search Surface, and API Key Handling (F1–F3)](#feature-navigation-search-surface-and-api-key-handling-f1f3)
    - [Architecture Decision](#architecture-decision-1)
    - [Component Tree](#component-tree)
    - [Routing](#routing)
    - [State & Data Flow](#state--data-flow-1)
    - [API Key Transport](#api-key-transport)
    - [File Validation](#file-validation-client-side-before-upload)
    - [Query Bar](#query-bar)
    - [Key Files](#key-files)
    - [Dependencies](#dependencies-1)
  - [Matching Pipeline (F4)](#feature-matching-pipeline-f4)
    - [Architecture Decision](#architecture-decision-2)
    - [Pipeline Stages](#pipeline-stages)
    - [Domain Types](#domain-types-packagescommunsrcmatchschemats)
    - [Confidence Scale](#confidence-scale)
    - [Stage 3 Execution Model](#stage-3-execution-model)
    - [NestJS Module Structure](#nestjs-module-structure)
    - [API Endpoints](#api-endpoints-1)
    - [Performance Targets](#performance-targets)
    - [Dependencies](#dependencies-2)
  - [Stage 2: Vocabulary Expansion](#stage-2-vocabulary-expansion)
    - [Architecture Decision](#architecture-decision-3)
    - [Vocabulary Singleton](#vocabulary-singleton)
    - [Refresh Strategy](#refresh-strategy)
    - [Expansion Algorithm](#expansion-algorithm)
    - [NestJS Module Structure](#nestjs-module-structure-1)
    - [Dependencies](#dependencies-3)
  - [Stage 3 L3: Vector Search on Local Mirror](#stage-3-l3-vector-search-on-local-mirror)
    - [Architecture Decision](#architecture-decision-4)
    - [Local MongoDB Infrastructure](#local-mongodb-infrastructure)
    - [Embedding Model Constraint](#embedding-model-constraint)
    - [Multi-Connection Pattern](#multi-connection-pattern)
    - [HNSW Index](#hnsw-index)
    - [Search Query](#search-query)
    - [RRF Fusion](#rrf-fusion)
    - [Admin Thresholds (1–10 scale)](#admin-thresholds-110-scale)

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

### Feature: Matching Pipeline (F4)

#### Architecture Decision

The matching pipeline is the core AI feature. It receives an image and/or text query,
runs a multi-stage LLM + retrieval pipeline, and returns ranked furniture matches.

Because the pipeline is long-running (p95 ~5–9 s) and involves multiple sequential and
parallel LLM calls, the API uses a **two-step SSE pattern** to avoid proxy timeouts and
give users live progress:

1. `POST /api/match` — accepts the upload, generates a `queryId`, returns `202` immediately.
2. `GET /api/match/:queryId/stream` — SSE stream; one event per completed stage; frontend
   renders results progressively.

The `MatchModule` is backend-only. All domain types live in `packages/common/src/match.schema.ts`.

#### Pipeline Stages

```
POST /api/match (202 → queryId)
  │
  ├──── Stage 0: Guardrail (Gemini Flash) ──────────────────────────────────────────┐
  │     guardrail_complete event → client shows detected_subject ~1 s in             │
  │                                                                                  │
  └──── Stage 1: Vision + Query Analysis (Gemini Pro) ─────────────────────────────┘
        analysis_complete event → client populates intent panel attributes
          │
          ├──────────────────────────────────────────── L3: Vector search (original analysis)
          │                                                                           │
          └── Stage 2: Vocabulary Expansion (Gemini Flash)                            │
              expansion_complete event → client updates intent panel                  │
                │                                                                     │
                ├── L1: Compound index filter (expanded analysis)                     │
                └── L2: BM25 template match (expanded analysis) ─────────── RRF fusion┘
                                                                                  │
                                                               retrieval_complete event
                                                               → client renders results immediately
                                                                                  │
                                                            Stage 4: Critic (Gemini Pro)
                                                            result event → scores overlay; stream ends
```

#### Domain Types (`packages/common/src/match.schema.ts`)

All Zod schemas and TypeScript interfaces for the entire pipeline live here. Key types:

| Type | Purpose |
|---|---|
| `Reasoned` | Base type for every LLM-attributed value — `confidence` (1–10) + `reasoning` |
| `GuardrailResponseSchema` | Stage 0 output — extends `Reasoned`, adds `detected_subject`, `additional_subjects` |
| `FurnitureAnalysisSchema` | Stage 1/2 output — unified analysis shape used throughout pipeline |
| `matchRequestSchema` | Validates `POST /api/match` text fields (file handled by `FileInterceptor`) |
| `MatchErrorCode` | All pipeline error codes emitted via SSE `error` event |
| `MatchSseEventTypeSchema` | Discriminated SSE event type enum |
| `MatchSseEvent` | Discriminated union of all typed SSE event interfaces |
| `PreliminaryMatchResult` | RRF-ranked candidate before critic — payload of `retrieval_complete` |
| `MatchResult` | Critic-scored candidate — payload of `result` |
| `MatchSearchIntent` | Shared intent block (reused in both response shapes) |
| `MatchPreliminaryResponse` | Payload of `retrieval_complete` event |
| `MatchResponse` | Payload of `result` event (final, critic scores populated) |

#### Confidence Scale

All `confidence` fields use a **1–10 scale** (`Reasoned.confidence`). A score of 7 means
genuinely acceptable. Admin thresholds use the same scale:

| Config field | Default | Meaning |
|---|---|---|
| `guardrailConfidenceThreshold` | 6 | Below this → `NOT_FURNITURE` |
| `overallConfidenceThreshold` | 4 | Below this → `LOW_CONFIDENCE` |
| `categoryConfidenceThreshold` | 7 | Below this → category filter dropped from L1/L2 |
| `typeConfidenceThreshold` | 7 | Below this → type filter dropped |

#### Stage 3 Execution Model

L3 starts immediately after Stage 1 using the **original unexpanded** analysis, in
parallel with Stage 2 and the L1/L2 calls. L1 and L2 wait for Stage 2; L3 does not.
RRF fusion waits for all three layers before emitting `retrieval_complete`.

#### NestJS Module Structure

```
apps/api/src/match/
├── dto/
│   └── match-request.dto.ts     ← extends createZodDto(matchRequestSchema)
├── match.controller.ts          ← POST /api/match + GET /api/match/:id/stream
├── match.service.ts             ← pipeline orchestration (Phase 2+)
└── match.module.ts              ← NestJS module, registered in AppModule
```

#### API Endpoints

##### POST /api/match
- **Request**: `multipart/form-data` — `image` (file, optional) + `userQuery` (string, optional)
- **Headers**: `x-gemini-key`, `x-openai-key`
- **Response**: `202 { queryId }`
- **Immediate errors**: `400 MISSING_INPUT`, `401 INVALID_KEY`

##### GET /api/match/:queryId/stream
- **Response**: `text/event-stream`
- **Events**: `guardrail_complete` → `analysis_complete` → `expansion_complete` → `retrieval_complete` → `result` (or `error` at any point)

#### Performance Targets

| Target | Value |
|---|---|
| Time to first results (p95) | < 5 s (`retrieval_complete` event) |
| Time to scored results (p95) | < 9 s (`result` event) |

Critical path: Stage 1 (Gemini Pro, 4–6 s p95) + Stage 2 (0.6–0.9 s) + max(L1/L2, L3) + Stage 4 (Gemini Pro, 4–6 s p95).

#### Dependencies

| Package | Location | Purpose |
|---|---|---|
| `@types/multer` | `apps/api` (dev) | `Express.Multer.File` type for file upload handling |
| `@nestjs/platform-express` | `apps/api` | Already installed — provides `FileInterceptor` |
| `rxjs` | `apps/api` | Already installed — NestJS SSE uses `Observable` |

---

### Stage 2: Vocabulary Expansion

See full flow and module dependency diagrams in [docs/architecture/stage2-l3.md](architecture/stage2-l3.md).

#### Architecture Decision

Stage 2 maps the raw LLM-generated terms from `FurnitureAnalysis` (e.g. `"armoire"`) to the
exact vocabulary present in the Atlas catalog (e.g. `"Wardrobes"`). This is necessary before
L1 (compound index filter) and L2 (BM25 template match) can produce useful results — MongoDB
compound index queries require exact token matches.

The vocabulary is stored as a **singleton document** (`_id: 'singleton'`) in the
`catalog_vocabulary` collection in local MongoDB. This design avoids querying Atlas on every
request. The document is refreshed on demand via `VocabularyService.refresh()`.

#### Vocabulary Singleton

The `catalog_vocabulary` document uses `_id: 'singleton'` (a plain string, not an ObjectId).
This is a Mongoose-level concern only — the Zod schema (`CatalogVocabularySchema`) does not
include `_id` to stay clean of persistence internals. The Mongoose schema is written manually
with `{ _id: { type: String } }` and includes a comment explaining this boundary.

#### Refresh Strategy

`VocabularyService.getVocabulary(maxAgeMs?)`:
1. Reads the singleton from local MongoDB
2. If absent or `refreshedAt` older than `maxAgeMs`, calls `refresh()`
3. Returns the `CatalogVocabulary` document

`VocabularyService.refresh(sampleSize?)`:
1. Queries Atlas for `distinct('category')` and `distinct('type')` (index-resident — fast)
2. Samples `sampleSize` products from Atlas
3. Extracts materials, colors, and styles via regex patterns; falls back to Gemini Flash for unmatched terms
4. Upserts `{ _id: 'singleton', ...vocabulary, refreshedAt: new Date() }` to local MongoDB

#### Expansion Algorithm

`VocabularyExpansionService.expand(analysis, vocabulary)`:
1. Extracts all `value` fields from the analysis
2. Case-insensitive exact match check — terms already in the vocabulary are kept unchanged (no LLM call)
3. Non-matching terms are batched into one Gemini Flash call via LangChain `withStructuredOutput`:
   ```typescript
   const MappingSchema = z.object({
     mappings: z.array(z.object({ original: z.string(), mapped: z.string() })),
   });
   ```
4. Reconstructs a new `FurnitureAnalysis` with mapped values
5. **NEVER throws** — catches all errors and returns the original analysis unchanged

**Execution timing**: L3 starts immediately after Stage 1 with the **original unexpanded**
analysis in parallel with Stage 2. L1 and L2 wait for Stage 2 to complete. L3 does NOT wait.

#### NestJS Module Structure

```
apps/api/src/
├── mirror/
│   ├── mirror.module.ts                              ← connectionName: 'local'
│   └── vocabulary/
│       ├── vocabulary.module.ts
│       ├── vocabulary.service.ts
│       └── schemas/
│           └── catalog-vocabulary.schema.ts          ← manual schema (_id: String)
└── pipeline/
    └── vocabulary-expansion/
        ├── vocabulary-expansion.module.ts
        └── vocabulary-expansion.service.ts
```

#### Dependencies

| Package | Location | Purpose |
|---|---|---|
| `@langchain/google-genai` | `apps/api` | Gemini Flash structured output for term mapping |

---

### Stage 3 L3: Vector Search on Local Mirror

See full search flow and data model diagrams in [docs/architecture/stage2-l3.md](architecture/stage2-l3.md).

#### Architecture Decision

L3 performs semantic vector search over product embeddings stored in local MongoDB.
Because Atlas is read-only, the `product_embeddings` collection and its HNSW index
live in the local `mongodb/mongodb-atlas-local:7.0` container.

L3 runs in parallel with Stage 2 using the **original unexpanded** analysis from Stage 1.
It does not wait for Stage 2 — see Stage 3 Execution Model above.

#### Local MongoDB Infrastructure

The local MongoDB container **must** use `mongodb/mongodb-atlas-local:7.0` — NOT the
community `mongo` image. Only the Atlas-local image supports `$vectorSearch` and
`createSearchIndex` with `type: 'vectorSearch'`.

`docker-compose.yml` at repo root:
- Image: `mongodb/mongodb-atlas-local:7.0`
- Port: `27017:27017`
- Named volume: `local_mongo_data`
- Health check: `mongosh --eval "db.adminCommand('ping')"`

#### Embedding Model Constraint

All embeddings in `product_embeddings` **must** use `text-embedding-004` (Gemini, 768
dimensions). Mixing embedding models invalidates cosine similarity — if the model ever
changes, the entire collection must be re-embedded.

`EmbeddingsService.reconstructProse(analysis)` converts `FurnitureAnalysis` to natural
language prose before embedding — never JSON:

```
"{furniture_type}. {category}. {styles joined}. {materials joined} construction. {colors joined}."
```

Null/empty fields are skipped. The output must not contain `{`, `}`, or `"confidence"`.

#### Multi-Connection Pattern

NestJS Mongoose requires the `connectionName: 'local'` string in **all three** registration
points or it silently binds to the Atlas default connection:

1. `MongooseModule.forRootAsync({ connectionName: 'local', ... })` — in `MirrorModule`
2. `MongooseModule.forFeature([...], 'local')` — in each child feature module
3. `@InjectModel(MODEL_NAME, 'local')` — in each service constructor

#### HNSW Index

The HNSW vector index is created in `EmbeddingsModule.onModuleInit()`:

```typescript
await collection.createSearchIndex({
  name: 'embedding_hnsw',
  type: 'vectorSearch',
  definition: {
    fields: [
      { type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' },
      { type: 'filter', path: 'category' },
      { type: 'filter', path: 'price' },
    ],
  },
});
```

"Already exists" errors are swallowed — creation is idempotent.
`autoIndex: true`, `autoCreate: true` for the local connection (writable).

#### Search Query

`EmbeddingsService.search(analysis, candidateCount, priceRange?, categoryFilter?)`:
1. `reconstructProse(analysis)` → prose string
2. `text-embedding-004` Gemini call → `number[768]`
3. `$vectorSearch` aggregation:

```typescript
{ $vectorSearch: {
  index: 'embedding_hnsw',
  path: 'embedding',
  queryVector: vector,
  numCandidates: candidateCount * 3,
  limit: candidateCount,
  filter: buildMqlFilter(priceRange, categoryFilter),
}}
```

Returns `product_id[]` in cosine-similarity rank order.

#### RRF Fusion

Stage 3 combines three retrieval layers (L1, L2, L3) using Reciprocal Rank Fusion.
The scores are on incomparable scales (boolean presence, BM25 score, cosine similarity),
so RRF provides a scale-invariant merge:

$$\text{rrfScore}(p) = \sum_{\ell \in \{L1, L2, L3\}} \frac{1}{k + \text{rank}_\ell(p)}$$

where $k = 60$ (standard RRF constant). Products not appearing in a layer receive rank $\infty$
(contributing 0 to the sum). Results are sorted descending by `rrfScore`.

#### Admin Thresholds (1–10 scale)

All admin confidence thresholds use the same 1–10 scale as `Reasoned.confidence`:

| Config field | Default | Range | Meaning |
|---|---|---|---|
| `guardrailConfidenceThreshold` | 6 | 1–10 | Below this → `NOT_FURNITURE` |
| `overallConfidenceThreshold` | 4 | 1–10 | Below this → `LOW_CONFIDENCE` (check `overall.confidence`) |
| `categoryConfidenceThreshold` | 7 | 1–10 | Below this → category filter dropped from L1/L2 |
| `typeConfidenceThreshold` | 7 | 1–10 | Below this → type filter dropped |
| `criticCandidateCount` | 10 | 10–50 | Max candidates passed to Stage 4 critic |

---
<!-- Add more features following the same structure -->
