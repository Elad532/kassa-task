# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Each entry maps to one commit: `[Unreleased/version] → commit → feature → change type`.
Every commit section opens with the prompt or intention that created it.

## [Unreleased]

### (api)/(config)->fix: wrap tsconfig.json compiler options in compilerOptions key

> **Prompt:** Commit the latest staged changes.
> **Intent:** The tsconfig.json was missing its `compilerOptions` wrapper, silently breaking decorator metadata in ts-jest. Fix it before it causes harder-to-diagnose test failures later.

#### Infrastructure
##### Fixed
- `apps/api/tsconfig.json` — compiler flags were at the top level instead of inside a `compilerOptions` object, making the file invalid and causing ts-jest to silently lose decorator metadata
- `.gitignore` — added `.claude/settings.local.json` to prevent accidental commits of local Claude Code allow-lists, which may contain credentials

---

### (api)/(catalog)->test: add e2e HTTP-layer tests for catalog and app endpoints

> **Prompt:** "Where are the tests? This isn't TDD."
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
