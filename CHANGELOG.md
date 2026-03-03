# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Each entry maps to one commit: `[Unreleased/version] → commit → feature → change type`.
Every commit section opens with the prompt or intention that created it.

## Table of Contents

- [Unreleased](#unreleased)
  - [(common,api)/(match)->feat: define Stage 2 and L3 types, modules, and public contracts](#commonapimatch-feat-define-stage-2-and-l3-types-modules-and-public-contracts)
  - [(root)/(docs)->docs: define Stage 2 and L3 architecture in TECH_SPEC with Mermaid diagrams](#rootdocs-docs-define-stage-2-and-l3-architecture-in-tech_spec-with-mermaid-diagrams)
  - [(root)/(docs)->docs: update PRD confidence scale and guardrail schema](#rootdocs-docs-update-prd-confidence-scale-and-guardrail-schema)
  - [(web)/(infra)->chore: add missing jest and mocha types](#webinfra-chore-add-missing-jest-and-mocha-types)
  - [(web)/(navigation)->feat: implement SearchSurface with file validation and query bar](#webnavigation-feat-implement-searchsurface-with-file-validation-and-query-bar)
  - [(web)/(navigation)->feat: implement NavBar with tab routing and key input](#webnavigation-feat-implement-navbar-with-tab-routing-and-key-input)
  - [(web)/(navigation)->feat: implement apiClient with x-gemini-key header injection](#webnavigation-feat-implement-apiclient-with-x-gemini-key-header-injection)
  - [(web)/(navigation)->test: add F1-F3 contract tests](#webnavigation-test-add-f1-f3-contract-tests)
  - [(web)/(navigation)->feat: scaffold NavBar, SearchSurface, ApiKeyContext, apiClient](#webnavigation-feat-scaffold-navbar-searchsurface-apikeycontext-apiclient)
  - [(web)/(navigation)->feat: define F1-F3 types and contracts](#webnavigation-feat-define-f1-f3-types-and-contracts)

---

## [Unreleased]

### (common,api)/(match)->feat: define Stage 2 and L3 types, modules, and public contracts

> **Intent:** Phase 1 (Domain Modeling) for Stage 2 (Vocabulary Expansion) and Stage 3 L3 (Vector Search on Local Mirror). Define all Zod schemas in `packages/common`, create stub NestJS modules (`MirrorModule`, `VocabularyModule`, `EmbeddingsModule`, `VocabularyExpansionModule`) with full public API signatures but no business logic, and wire them into `AppModule`.

#### Stage 2 — Vocabulary Expansion
##### Added
- `packages/common/src/vocabulary.schema.ts` — `CatalogVocabularySchema` (singleton document shape: categories, types, styles, materials, colors, refreshedAt) and `ProductEmbeddingSchema` (product_id, category, type, price, 768-dim embedding vector, embedded_text, timestamps)
- `apps/api/src/mirror/mirror.module.ts` — `MirrorModule` with `connectionName: 'local'` for local MongoDB; imports and exports `VocabularyModule` and `EmbeddingsModule`
- `apps/api/src/mirror/vocabulary/vocabulary.module.ts` — `VocabularyModule`; `forFeature` bound to `'local'` connection; exports `VocabularyService`
- `apps/api/src/mirror/vocabulary/vocabulary.service.ts` — stub `VocabularyService` with `getVocabulary(maxAgeMs?)` and `refresh(sampleSize?)` signatures
- `apps/api/src/mirror/vocabulary/schemas/catalog-vocabulary.schema.ts` — manual Mongoose schema with `_id: String` (singleton pattern, `ObjectId` explicitly not used); Zod schema intentionally omits `_id`
- `apps/api/src/pipeline/vocabulary-expansion/vocabulary-expansion.module.ts` — `VocabularyExpansionModule`; exports `VocabularyExpansionService`
- `apps/api/src/pipeline/vocabulary-expansion/vocabulary-expansion.service.ts` — stub `VocabularyExpansionService.expand(analysis, vocabulary)` — never throws; returns original analysis on any error

#### Stage 3 L3 — Vector Search on Local Mirror
##### Added
- `apps/api/src/mirror/embeddings/embeddings.module.ts` — `EmbeddingsModule`; `forFeature` bound to `'local'` connection; exports `EmbeddingsService`
- `apps/api/src/mirror/embeddings/embeddings.service.ts` — stub `EmbeddingsService` with `isReady()`, `reconstructProse(analysis)`, and `search(analysis, candidateCount, priceRange?, categoryFilter?)` signatures; documents that L3 always uses the **original unexpanded** analysis from Stage 1
- `apps/api/src/mirror/embeddings/schemas/product-embedding.schema.ts` — manual Mongoose schema (manual because `zodToMongooseSchema` does not yet handle `z.array(z.number())` for the 768-dim vector); compound index on `{ category: 1, price: 1 }` for `$vectorSearch` pre-filtering

##### Changed
- `packages/common/src/analysis.schema.ts` — `ReasonedSchema`, `StringAttributeSchema`, `DimensionsAttributeSchema`, `PriceRangeAttributeSchema`, `FurnitureAnalysisSchema`, `GuardrailResponseSchema` extracted into dedicated file (mirrors `f4-stage0-domain` design, adapted for this branch)
- `packages/common/src/index.ts` — exports all new schemas and types from `analysis.schema.ts` and `vocabulary.schema.ts`
- `apps/api/src/app.module.ts` — imports `MirrorModule` and `VocabularyExpansionModule`
- `apps/api/src/catalog/utils/zod-to-mongoose.ts` — fixed `type.unwrap()` cast to `z.ZodTypeAny` to resolve Zod v4 compatibility (returns `$ZodType`, not `ZodTypeAny`)

---

### (root)/(docs)->docs: define Stage 2 and L3 architecture in TECH_SPEC with Mermaid diagrams

> **Intent:** Document the Stage 2 (Vocabulary Expansion) and Stage 3 L3 (Vector Search on Local Mirror) architecture in TECH_SPEC, with architecture diagram links to a new `docs/architecture/stage2-l3.md` file containing Mermaid flowcharts, class diagrams, and a module dependency graph.

#### Stage 2 — Vocabulary Expansion
##### Added
- `docs/TECH_SPEC.md` — Stage 2 section: architecture decision, vocabulary singleton design (`_id: 'singleton'`), refresh strategy, expansion algorithm, NestJS module structure, dependency on `@langchain/google-genai`
- `docs/TECH_SPEC.md` — Stage 3 L3 section: architecture decision, local MongoDB infrastructure (Atlas-local image requirement), embedding model constraint, multi-connection pattern, HNSW index, search query, RRF fusion formula, admin thresholds table
- `docs/architecture/stage2-l3.md` — Four Mermaid diagrams: (1) Stage 2 expansion flowchart (vocabulary lookup → LLM batch → reconstructed analysis); (2) Stage 3 L3 search flowchart (reconstructProse → embed → $vectorSearch → product_ids); (3) local mirror data model class diagram (`CatalogVocabularySchema`, `ProductEmbeddingSchema`, services); (4) NestJS module dependency graph (`AppModule` → `MirrorModule`, `VocabularyExpansionModule`)

##### Changed
- `docs/TECH_SPEC.md` — Added reference links from Stage 2 and L3 sections to `docs/architecture/stage2-l3.md`

---

### (root)/(docs)->docs: update PRD confidence scale and guardrail schema

> **Intent:** Standardize quality thresholds in the PRD to a 1–10 integer scale for better consistency with LLM calibration anchors and back-office UI. Enhanced the guardrail schema to support multi-subject detection via `additional_subjects`.

#### Documentation
##### Changed
- `docs/PRD.md` — Refactored all confidence thresholds (`overall`, `category`, `type`, `guardrail`) from 0–1 floats to a 1–10 integer scale.
- `docs/PRD.md` — Updated `GuardrailResponseSchema` to extend `Reasoned` and added the `additional_subjects` field to support scenes with multiple furniture items.
- `docs/PRD.md` — Updated guardrail prompt instructions to specifically handle foreground vs. background subjects.
- `docs/PRD.md` — Lowered default `criticCandidateCount` from 25 to 10.

---

### (web)/(infra)->chore: add missing jest and mocha types

> **Intent:** Resolve TypeScript environment inconsistencies in the web workspace by adding missing `@types/jest` and `@types/mocha` dependencies.

#### Infrastructure
##### Changed
- `apps/web/package.json` — Added `@types/jest` and `@types/mocha` to dependencies.
- `pnpm-lock.yaml` — Updated to reflect new workspace dependencies.

---


### (web)/(navigation)->feat: implement SearchSurface with file validation and query bar

> **Prompt:** "Yes" (proceed with Phase 4 implementation)
> **Intent:** Implement the full SearchSurface component — drag-and-drop file upload, client-side MIME/size validation, live character counter with paste truncation, and FormData submission via apiFetch. Also fixes an ambiguous test regex that matched both the character counter and the paste warning simultaneously.

#### F2 — Search Surface
##### Added
- `apps/web/components/SearchSurface.tsx` — full implementation: drag-and-drop + file picker, MIME type validation (JPEG/PNG/WebP only), 10 MB size limit, image preview via `URL.createObjectURL`, 500-character query bar with live counter, paste truncation with visible warning, submit button disabled until image or query present, FormData body with `image` and `userQuery` fields sent via `apiFetch`

##### Changed
- `apps/web/__tests__/SearchSurface.test.tsx` — narrowed paste-warning assertion from `/truncated|limit|500/i` to `/truncated/i` to avoid ambiguous match with the always-visible `500/500` counter

---

### (web)/(navigation)->feat: implement NavBar with tab routing and key input

> **Prompt:** "Yes" (proceed with Phase 4 implementation)
> **Intent:** Wire up the NavBar stub — connect API key input to ApiKeyContext so the key is stored in React state only, and use Next.js Link for client-side tab navigation.

#### F1 — Navigation Bar
##### Changed
- `apps/web/components/NavBar.tsx` — uses `Link` from `next/link` for End User (`/`) and Admin (`/admin`) tabs; `<input type="password">` `onChange` calls `setApiKey()` from `useApiKey()` context hook

---

### (web)/(navigation)->feat: implement apiClient with x-gemini-key header injection

> **Prompt:** "Yes" (proceed with Phase 4 implementation)
> **Intent:** Implement the fetch wrapper that injects the user's Gemini API key as an `x-gemini-key` header on every request when a key is present, and omits the header entirely when the key is empty so the backend falls through to the admin key.

#### F3 — API Key Handling
##### Changed
- `apps/web/lib/apiClient.ts` — builds a `Headers` object from the incoming `init.headers`, sets `x-gemini-key: <apiKey>` when `apiKey` is non-empty, then passes the merged headers to `fetch()`

---

### (web)/(navigation)->test: add F1-F3 contract tests

> **Prompt:** "Yes" (proceed with Phase 3)
> **Intent:** Write integration tests that define the public contracts for NavBar, SearchSurface, ApiKeyContext, and apiClient. All tests that require real implementation must fail against the current stubs — confirming that tests drive, not follow, implementation.

#### F1 — Navigation Bar
##### Added
- `apps/web/__tests__/NavBar.test.tsx` — 6 contract tests: link text, href attributes, `type="password"`, and `setApiKey` called on input change

#### F2 — Search Surface
##### Added
- `apps/web/__tests__/SearchSurface.test.tsx` — 11 contract tests: submit disabled state, MIME validation, size validation, image preview (file input and drop), placeholder text, character counter, paste truncation warning, FormData submission shape

#### F3 — API Key Handling
##### Added
- `apps/web/__tests__/ApiKeyContext.test.tsx` — 4 contract tests: initial state, `setApiKey` update, no `localStorage` write, no `sessionStorage` write
- `apps/web/__tests__/apiClient.test.ts` — 2 contract tests: `x-gemini-key` header injected when key non-empty, omitted when key empty

---

### (web)/(navigation)->feat: scaffold NavBar, SearchSurface, ApiKeyContext, apiClient

> **Prompt:** "Yes" (proceed with Phase 2)
> **Intent:** Create all skeleton files for F1–F3 — stubbed components that satisfy the type system and compile, but return placeholder responses. Wire ApiKeyProvider and NavBar into the root layout; replace the hello-world home page with SearchSurface.

#### F1 / F2 / F3 — Navigation, Search Surface, API Key Handling
##### Added
- `apps/web/context/ApiKeyContext.tsx` — React Context with `useState("")` provider and `useApiKey()` hook (stub always returns empty string)
- `apps/web/components/NavBar.tsx` — static links and password input, no logic
- `apps/web/components/SearchSurface.tsx` — drop zone, query input, submit button stub
- `apps/web/lib/apiClient.ts` — bare `fetch()` pass-through, no header injection
- `apps/web/app/admin/page.tsx` — placeholder `<main>Admin page</main>`

##### Changed
- `apps/web/app/layout.tsx` — wraps children in `<ApiKeyProvider>`, renders `<NavBar />` above page content
- `apps/web/app/page.tsx` — replaces hello-world `fetch('/api/hello')` component with `<SearchSurface />`
- `apps/web/__tests__/page.test.tsx` — updated smoke test to match new home page content

---

### (web)/(navigation)->feat: define F1-F3 types and contracts

> **Prompt:** "let's plan how to implement F1 to F3 - navigation bar, search surface, and API key handling"
> **Intent:** Establish the shared domain types for F1–F3 before writing any implementation. ProviderKeys is a backend-visible shared type and belongs in packages/common; SearchFormState uses the browser-only File type and stays in the web app.

#### F1 / F2 / F3 — Navigation, Search Surface, API Key Handling
##### Added
- `packages/common/src/search.schema.ts` — `ProviderKeys` interface `{ gemini: string | null, openai: string | null }` — shared domain model for per-request key resolution; user keys ephemeral, admin keys persisted server-side (F7)
- `apps/web/types/search.ts` — `SearchFormState` interface `{ image: File | null, query: string }` — web-only because `File` is a browser DOM type unavailable in the Node build of `packages/common`

##### Changed
- `packages/common/src/index.ts` — exports `ProviderKeys` from the new `search.schema` module

---

### (root)/(docs)->docs: add table of contents to all human-facing documents

> **Prompt:** "the changelog, readme, and other human facing documents should have a table of contents. update all of them now"
> **Intent:** Improve navigability of all human-facing documents by adding a Table of Contents section after each title.

#### Documentation
##### Changed
- `CHANGELOG.md` — added TOC linking to each version section; added `---` separator between TOC and content
- `README.md` — added full TOC with nested sub-links covering all 10 sections
- `docs/TECH_SPEC.md` — added nested TOC down to section level (Architecture Decision, Data Models, Atlas Indexes, API Endpoints, etc.)
- `docs/PRD.md` — added minimal TOC matching the template structure (grows as features are added)

---

### (api)/(config)->fix: wrap tsconfig.json compiler options in compilerOptions key

> **Prompt:** "Fix the app.service annotation errors"
> **Intent:** The tsconfig.json was missing its `compilerOptions` wrapper, silently breaking decorator metadata in ts-jest. Fix it before it causes harder-to-diagnose test failures later.

#### Infrastructure
##### Fixed
- `apps/api/tsconfig.json` — compiler flags were at the top level instead of inside a `compilerOptions` object, making the file invalid and causing ts-jest to silently lose decorator metadata
- `.gitignore` — added `.claude/settings.local.json` to prevent accidental commits of local Claude Code allow-lists, which may contain credentials

---

### (api)/(catalog)->test: add e2e HTTP-layer tests for catalog and app endpoints

> **Prompt:** "Create the e2e tests"
> **Intent:** The existing tests only covered the service layer in isolation. The HTTP stack — routing, global pipes, status codes, validation errors — was completely untested. Add a full e2e suite that boots a real NestJS app and sends actual HTTP requests.

#### Product Catalog
##### Added
- `test/catalog.e2e-spec.ts` — 17 supertest tests against a real `INestApplication` wired to `mongodb-memory-server`; covers routing (search-before-id guard), `ZodValidationPipe` rejections, all query param combinations, and `200`/`400`/`404` response shapes
- `jest-e2e.config.js` — separate Jest config for the `test/*.e2e-spec.ts` suite so e2e and unit tests can be run independently
- `test:e2e` script in `apps/api/package.json`

##### Changed
- `test/app.e2e-spec.ts` — fixed to import `AppController`/`AppService` directly so the hello-world test no longer requires an Atlas connection to run

---

### (api)/(catalog)->test: add service contract tests and Atlas index validation

> **Intent:** Verify the service layer contracts before considering the implementation done. Also assert that the three Atlas indexes the queries depend on actually exist — if someone drops an index, the test suite should catch it before production does.

#### Product Catalog
##### Added
- `catalog.service.spec.ts` — 20 unit/integration tests against `mongodb-memory-server` covering `filter()`, `search()`, and `findById()`; all filter combinations, text search with limit, and error paths (`NotFoundException`, `BadRequestException`)
- `catalog.indexes.spec.ts` — connects to the real Atlas cluster to assert all 3 indexes exist with correct key patterns and text weights; skips automatically when `MONGODB_URI` is not set

##### Changed
- `app.controller.spec.ts` — updated to assert the `{ id, message }` response shape and removed the `AppModule` import (no longer needs Atlas to run)
- `jest.config.js` — ts-jest now receives `tsconfig.build.json` explicitly so decorator metadata compiles correctly during unit tests

---

### (api)/(catalog)->feat: scaffold catalog read-only module with MongooseModule

> **Intent:** Expose the existing Atlas product collection through a typed NestJS API. The module must be self-contained (owns its own DB connection), strictly read-only (no writes, no index creation), and validated at the HTTP boundary via Zod.

#### Product Catalog
##### Added
- `zodToMongooseSchema()` utility — derives a Mongoose `Schema` directly from a Zod object; no `@Prop` decorators or duplicate field declarations needed
- `CatalogModule` — self-contained read-only module with its own `MongooseModule.forRoot` (Atlas, `autoIndex: false`, `autoCreate: false`)
- `GET /api/catalog/products` — filter by `category`, `type`, `minPrice`, `maxPrice` using the compound index
- `GET /api/catalog/products/search` — full-text search on title + description with configurable `limit` using the text index
- `GET /api/catalog/products/:id` — find a single product by MongoDB ObjectId
- `ZodValidationPipe` applied globally — query params validated on every request; invalid input returns `400` with field-level error details
- `apps/api/.env.example` — environment variable template (no real credentials)
- `nestjs-zod`, `@nestjs/config` runtime dependencies; `mongodb-memory-server` dev dependency

##### Changed
- `app.module.ts` — simplified to `ConfigModule` (global) + `CatalogModule` only; removed dead `Mongoose`/`MongooseModule` imports
- `main.ts` — added `app.useGlobalPipes(new ZodValidationPipe())`
- `apps/api/.env.example` — moved from monorepo root to `apps/api/` so `ConfigModule.forRoot()` finds it at the NestJS process CWD

---

### (common)/(product)->feat: define Product Zod schemas and query types

> **Intent:** Domain modeling phase — establish the Product entity shape before writing any implementation. By defining it in Zod, TypeScript types, NestJS DTOs, and Mongoose schemas can all be derived from one place with no duplication.

#### Product Catalog
##### Added
- `packages/common/src/product.schema.ts` — Zod schemas for the `Product` entity, filter query params, and full-text search params; single source of truth — TypeScript types, NestJS DTOs, and Mongoose schemas all derived from here
- `zod` runtime dependency in `packages/common`

---

### (root)/(docs)->docs: add Product catalog entity and API spec to TECH_SPEC

> **Intent:** Per project rules, TECH_SPEC must be updated before any logic flow changes. Document the catalog entity, the three Atlas indexes, the three API endpoints, and the Zod-as-single-source-of-truth pattern so the implementation has a clear contract to follow.

#### Product Catalog
##### Added
- `docs/TECH_SPEC.md` — Product Catalog feature spec: entity fields, confirmed Atlas indexes with key patterns and weights, API endpoint table, and the Zod-as-single-source-of-truth architecture pattern
- `docs/architecture/catalog.md` — Mermaid sequence diagram for filter/search/findById flows and class diagram of the Zod → DTO → Mongoose pipeline

---
<!-- When releasing, rename [Unreleased] to the version and date, then add a new empty [Unreleased] section above -->
<!-- Example: ## [1.0.0] - 2026-03-02 -->
