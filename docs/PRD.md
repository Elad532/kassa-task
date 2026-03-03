# Furniture Visual Search — Product Requirements Document

**Version**: 4.0
**Status**: Final pre-implementation

---

## Table of Contents

- [Project Overview](#project-overview)
- [Ambiguities & Assumptions](#ambiguities--assumptions)
- [Features](#features)
  - [F1 — Navigation Bar](#f1--navigation-bar)
  - [F2 — Search Surface](#f2--search-surface)
  - [F3 — API Key Handling](#f3--api-key-handling)
  - [F4 — Matching Pipeline](#f4--matching-pipeline)
    - [Text-Only Mode](#text-only-mode)
    - [Stage 0 — Parallel Guardrail + Vision/Query Analysis](#stage-0--parallel-guardrail--visionquery-analysis)
    - [Stage 1 — Unified Vision + Query Analysis Output](#stage-1--unified-vision--query-analysis-output)
    - [Stage 2 — Vocabulary Expansion](#stage-2--vocabulary-expansion)
    - [Stage 3 — Three-Layer Retrieval](#stage-3--three-layer-retrieval)
    - [Stage 4 — Critic Evaluation](#stage-4--critic-evaluation)
  - [F5 — Search Intent Panel](#f5--search-intent-panel)
  - [F6 — Results Display](#f6--results-display)
  - [F7 — Admin Page](#f7--admin-page)
  - [F8 — Evaluation Logging](#f8--evaluation-logging)
- [Data Architecture](#data-architecture)
- [Catalog Mirror Sync Strategy](#catalog-mirror-sync-strategy)
- [Provider Strategy](#provider-strategy)
- [API Contract](#api-contract)
- [Non-Functional Requirements](#non-functional-requirements)
- [Key Design Choices](#key-design-choices)
- [Tradeoffs](#tradeoffs)
- [Future Enhancements](#future-enhancements)

---

## Project Overview

A full-stack application that lets a user upload an image of a furniture item and receive
relevant ranked matches from a read-only furniture catalog, optionally refined by a
natural language query. The system evaluates match quality — not just whether results are
returned — using a multi-layer retrieval strategy and an LLM critic pass.

The catalog is read-only and has no vector index. Its only indexes are a BM25 full-text
index on `title` and `description`, and a compound index on `{category, type, price}`.
Because a vector index cannot be added to the Atlas collection, semantic vector search is
implemented in a separate local store that mirrors the catalog.

Retrieval uses three complementary layers, each exploiting a different index or data source:

- **L1 (Structured)** — Compound index equality + range filter on `{category, type, price}`.
  Fast, deterministic, requires no text. Always available.
- **L2 (Lexical)** — BM25 `$text` search using a reconstructed description template.
  Exploits the catalog's formulaic descriptions. Always available.
- **L3 (Semantic)** — HNSW vector search on a local MongoDB mirror with pre-computed
  Gemini embeddings. Solves vocabulary mismatch ("armoire" ↔ "wardrobe"). Requires
  pre-computation and real-time sync.

When L3 is available, all three layers run and results are fused via Reciprocal Rank
Fusion (RRF). When L3 is unavailable, the system degrades gracefully to L1 + L2 only.
Price filtering is only possible when the user explicitly states a budget in their text
query or when a price tag is visible in the uploaded image — it is not inferrable from
visual content alone.

---

## Ambiguities & Assumptions

| Ambiguity | Assumption | Rationale |
|---|---|---|
| Catalog has no images or vectors | Vision model extracts structured attributes; those drive hybrid retrieval against text fields | Only viable approach given read-only, image-free catalog |
| Evaluation mechanism | Actor-critic: Gemini Pro retrieves, Gemini Pro judges. Critic scores shown to user | Single provider, two model roles, cross-validated quality signal |
| Admin page auth | No auth — demo scope | Explicit product decision for this phase |
| Evaluation log storage | Local MongoDB via docker-compose | Keeps eval infrastructure co-located with the mirror |
| AI provider | Gemini primary, GPT-4o fallback on retryable errors (429, 5xx) | Cost-effective primary with commercial-grade fallback |
| Scale target | Architecture must support 1M+ products | Explicit product requirement |
| Price signal | Only inferrable from user text query or a visible price tag in the image | Images rarely carry pricing signal |
| Atlas write access | Entire Atlas cluster is read-only — no new indexes or collections possible | Connection string is read-only by construction |
| Guardrail + vision execution | Parallel — discard vision result if guardrail fails | Lower latency; guardrail cost is negligible |
| Multi-layer score fusion | RRF with hit count as a first-class signal | Score normalization problem makes weighted sum unreliable across structured, lexical, and semantic layers |
| Admin API keys | Persisted to local MongoDB — survive server restarts | Avoids per-restart reconfiguration in production |
| Embedding provider | Gemini only for all embeddings — no fallback | Model consistency is a hard correctness constraint: mixing embedding models invalidates cosine similarity across the entire index |
| Query handling | User query is sent alongside the image in a single LLM call with higher significance applied to query terms | Simpler pipeline; query intent naturally weighted by prompt design |
| Retrieval candidate count | Controlled by admin panel per layer | Allows tuning without code changes |
| Critic scalability | Critic operates on a capped candidate set (admin-configurable, default 25) | Fitting 200 items into a single LLM context is not feasible at scale |
| Text-only guardrail | When no image is submitted, a text-only LLM guardrail check confirms the query is furniture-related | Prevents off-domain text queries reaching retrieval |
| Vocabulary sample size | Style/material/color vocabulary extracted from 200 randomly sampled products | Catalog descriptions follow a formulaic template; 200 samples reliably covers all distinct pattern permutations. Sample size is admin-configurable if the catalog expands significantly. |
| L1 and L2 independence | L1 (compound index) and L2 (BM25 `$text`) use different indexes on the same Atlas collection — independent at the retrieval mechanism level, though candidate sets can overlap | RRF benefits from independent signals; overlap is not harmful — it boosts RRF score, which is the intended behaviour |

---

## Features

---

### F1 — Navigation Bar

#### Problem Statement
Users need to switch between the end-user search experience and the admin configuration
panel. The API key must be accessible from anywhere in the application without requiring
a separate settings flow.

#### User Stories
- As a user, I want a persistent API key input so I can set it once and use the
  application without re-entering it on every search.
- As an admin, I want a clearly labelled admin tab so I can reach the configuration
  panel from anywhere.

#### Acceptance Criteria
- [ ] WHEN the application loads, THEN a navigation bar is visible on all pages
- [ ] The nav bar SHALL contain: End User tab, Admin tab, API key input field
- [ ] WHEN a user enters a key in the API key field, THEN it is stored in React
  component state only — never written to localStorage, sessionStorage, or any
  persistent store
- [ ] GIVEN admin keys are configured on the server, WHEN a user submits a search
  without entering a personal key, THEN the admin key is used transparently
- [ ] The API key input SHALL render as a password field (characters masked)

> Key storage and transport rules are owned by [F3 — API Key Handling](#f3--api-key-handling).

#### Out of Scope
- Authentication or role-based access control
- Multiple user sessions or key management

---

### F2 — Search Surface

#### Problem Statement
Users know what furniture looks like but often cannot name it precisely. They need a
single, unified interface to submit both a visual reference and optional natural language
refinement — including price constraints that cannot be communicated through an image
alone.

#### User Stories
- As a user, I want to upload a photo of a furniture item so I can find visually similar
  products in the catalog.
- As a user, I want a single search bar where I can type a natural language query to
  refine results, and update it to re-search without starting over.
- As a user, I want to filter by price by describing it in my query — for example
  "under $500" or "around $1,000" — since the image alone cannot convey price.

#### Acceptance Criteria
- [ ] WHEN a user drags a file onto the upload area OR uses the file picker, THEN a
  preview of the image is shown immediately
- [ ] The image upload SHALL accept JPEG, PNG, and WebP only, enforced client-side
  before upload
- [ ] The image upload SHALL reject files larger than 10MB client-side, with a
  descriptive error message
- [ ] The query bar SHALL be a single persistent text input — not a chat. Submitting
  replaces the previous value, it is never appended
- [ ] The query bar SHALL enforce a 500 character limit with a live character counter
- [ ] The submit button SHALL be disabled until at least one input — image or query —
  is present
- [ ] WHEN the search is submitted, THEN both inputs are sent together as
  `multipart/form-data`
- [ ] The query bar placeholder text SHALL read: *"Add details like color, style, or
  price range to refine results"*

#### Out of Scope
- Multi-image upload
- Chat-style iterative refinement
- Voice input

#### Edge Cases
- User submits with only a query and no image → pipeline runs in text-only mode;
  a lightweight text guardrail confirms the query is furniture-related before proceeding
- User submits with only an image and no query → price filtering is unavailable;
  intent panel notes this
- User pastes a paragraph into the query bar → 500 character limit truncates with
  a visible warning

---

### F3 — API Key Handling

#### Problem Statement
The application requires a Gemini API key to function. User-supplied keys are ephemeral
credentials that must never be stored persistently. Admin-configured keys are persisted
to local MongoDB so the system works across server restarts without re-entry.

#### User Stories
- As a user, I want my API key to exist only for the duration of my browser session so
  I can trust it is not stored anywhere.
- As an admin, I want to configure server-side keys so that end users do not need to
  supply their own, and those keys survive a server restart.

#### Acceptance Criteria
- [ ] WHEN a user enters an API key in the navigation bar, THEN it is stored in React
  component state only — never written to localStorage, sessionStorage, or any
  persistent store
- [ ] The user key SHALL travel to the backend on every request via the `x-gemini-key`
  request header (primary) or `x-openai-key` request header (fallback provider)
- [ ] The backend SHALL extract the user key per-request and pass it directly to the
  provider SDK — never logging or caching it
- [ ] GIVEN admin keys are configured, WHEN a request arrives without a user key
  header, THEN the admin key is used
- [ ] WHEN a key is invalid or expired, THEN a 401 is returned with a clear
  user-facing message before any pipeline work begins
- [ ] Admin-configured keys SHALL be persisted in local MongoDB and survive server
  restarts

#### Domain Model
- **ProviderKeys**: `{ gemini: string | null, openai: string | null }` — resolved
  per-request from admin config (persisted) and request headers (ephemeral), never logged

#### Out of Scope
- OAuth or third-party auth flows
- Key rotation or expiry tracking

---

### F4 — Matching Pipeline

#### Problem Statement
Matching a furniture image against a large catalog with only text fields and BM25 indexes
requires multiple complementary retrieval strategies. No single approach — structured
filtering, keyword search, or vector similarity — covers all failure modes. The pipeline
must be layered, explainable, and degrade gracefully when components are unavailable.

#### User Stories
- As a user, I want the system to understand what I am looking for from both my image
  and my query so that results reflect my actual intent.
- As a user, I want results scored by a second AI pass so I can trust that the top
  result is genuinely the best match, not just a keyword coincidence.

> **Pipeline diagram**: see `docs/architecture/matching-pipeline.md` for the full
> Mermaid sequence diagram covering both standard and text-only paths.

---

#### Text-Only Mode

When a request arrives with no image (query only), the pipeline runs a modified path:

- **Stage 0**: The image guardrail is replaced by a lightweight text-only LLM check
  that confirms the query is furniture-related. If the query is off-domain (e.g.
  "accounting software recommendations"), a 422 `NOT_FURNITURE` is returned immediately.
- **Stage 1**: Runs in text-analysis-only mode — no vision call. The `FurnitureAnalysis`
  is populated from the user query alone.
- **Stages 2–4**: Run identically to the standard image path.

Price filtering is available in text-only mode when the user explicitly states a price
in their query.

---

#### Stage 0 — Parallel Guardrail + Vision/Query Analysis

##### Problem Statement
Running the full vision analysis on a non-furniture image wastes expensive model calls.
The guardrail catches invalid inputs cheaply. Running it in parallel with vision keeps
latency low.

##### Acceptance Criteria
- [ ] WHEN a request is received WITH an image, THEN the guardrail call and the
  vision+query call SHALL fire simultaneously
- [ ] GIVEN the guardrail returns `is_furniture: false` OR `confidence <
  guardrailConfidenceThreshold`, THEN the pipeline SHALL stop immediately with a 422
  `NOT_FURNITURE`, discarding the vision result
- [ ] GIVEN the guardrail passes, THEN the vision result is used as Stage 1 output
- [ ] GIVEN the guardrail call itself fails, THEN the pipeline SHALL stop with a 502
  — do not proceed without validation
- [ ] The guardrail confidence threshold SHALL be admin-configurable (default 6, range 1–10)

##### Domain Model
```typescript
const GuardrailResponseSchema = Reasoned.extend({
  is_furniture:        z.boolean(),
  detected_subject:    z.string(),
  additional_subjects: z.array(z.string()),
});
```

`GuardrailResponseSchema` extends `Reasoned` (defined in Stage 1) for a consistent
confidence shape across all LLM outputs. `additional_subjects` lists other clearly visible
furniture items in the scene beyond the primary subject; empty when only one item is present.

##### Edge Cases
- Guardrail passes but vision call failed independently → 502 `VISION_FAILED`
- Image contains furniture in the background but not as the primary subject → guardrail
  prompt instructs: report on the dominant foreground subject in `detected_subject`; list
  other visible furniture items in `additional_subjects`; ignore non-furniture background decor

---

#### Stage 1 — Unified Vision + Query Analysis Output

##### Problem Statement
Vision and query must produce the same data shape so they can be merged cleanly. Price
is a first-class field because it may appear as a visible tag in the image or be stated
explicitly in the query — the schema must accommodate both sources.

##### Acceptance Criteria
- [ ] The image and user query SHALL be sent together in a single LLM call
- [ ] The prompt SHALL explicitly instruct the model to treat user query terms with
  higher significance than visual inference — query terms override or reinforce visual
  observations
- [ ] The output SHALL be a single `FurnitureAnalysis` instance, validated by Zod
- [ ] WHEN the LLM returns invalid JSON, THEN the backend SHALL retry once with a
  stricter prompt before returning 502
- [ ] Each attribute SHALL carry its own `confidence` (1–10) and `reasoning` (max 80
  characters)
- [ ] `price_range` SHALL be populated when a price appears in the user query OR is
  visible as a price tag in the image; otherwise null
- [ ] The prompt SHALL be injected with the catalog vocabulary (categories, types,
  styles, materials, colors) to ground outputs in catalog terminology
- [ ] WHEN `overall.confidence` is below `overallConfidenceThreshold` (default 4, range 1–10,
  admin-configurable), THEN a 422 `LOW_CONFIDENCE` is returned before retrieval

##### Domain Model
```typescript
// Shared base for every LLM-attributed value. confidence uses a 1–10 scale; 7 = genuinely acceptable.
const Reasoned = z.object({
  confidence: z.number().min(1).max(10),
  reasoning:  z.string().max(80),
});

const StringAttribute = Reasoned.extend({
  value: z.string(),
});

const DimensionsAttribute = Reasoned.extend({
  width_cm:  z.number().nullable(),
  height_cm: z.number().nullable(),
  depth_cm:  z.number().nullable(),
});

const PriceRangeAttribute = Reasoned.extend({
  price_start: z.number().nullable(),
  price_end:   z.number().nullable(),
});

const FurnitureAnalysisSchema = z.object({
  furniture_type:    StringAttribute.nullable(),
  category:          StringAttribute.nullable(),
  style_descriptors: z.array(StringAttribute),
  materials:         z.array(StringAttribute),
  color_palette:     z.array(StringAttribute),
  dimensions:        DimensionsAttribute.nullable(),
  price_range:       PriceRangeAttribute.nullable(),
  overall:           Reasoned,  // holistic confidence that the analysis is usable for retrieval
});

type FurnitureAnalysis = z.infer<typeof FurnitureAnalysisSchema>;
```

`FurnitureAnalysisSchema` is the **single shared type** used throughout the entire
pipeline — LLM output parsing, vocabulary expansion input/output, retrieval input, eval
log storage, and API response. No duplicate interface definitions exist anywhere in the
codebase.

##### Edge Cases
- `overall.confidence < overallConfidenceThreshold` → 422 `LOW_CONFIDENCE` before retrieval
- All array fields empty and all singular fields null → query influence detection flags
  `no_intent_extracted`
- User query contradicts the image (e.g. "show me dining tables" with a sofa image) →
  query has higher weight; results drift toward query intent; search intent panel makes
  the override visible to the user

---

#### Stage 2 — Vocabulary Expansion

##### Problem Statement
The vision model may use terms that do not exist in the catalog — "armoire" instead of
"Corner Wardrobe", "walnut tones" instead of "Walnut". Vocabulary expansion maps analysis
outputs to actual catalog terms before structured and lexical retrieval so that L1 and L2
operate against catalog vocabulary exactly. L3 handles vocabulary mismatch intrinsically
via the embedding space and uses the original unexpanded analysis.

##### Acceptance Criteria
- [ ] Stage 2 SHALL take a `FurnitureAnalysis` as input and return a new
  `FurnitureAnalysis` instance with values mapped to catalog vocabulary
- [ ] The same `FurnitureAnalysisSchema` SHALL be used for both input and output
- [ ] The expanded analysis SHALL feed L1 and L2 retrieval; the original unexpanded
  analysis SHALL feed L3
- [ ] Stage 2 is sequential to L1 and L2 only — L3 starts immediately after Stage 1
  using the original unexpanded analysis, in parallel with Stage 2 and the L1/L2 calls
- [ ] WHEN Stage 2 fails, THEN the pipeline SHALL continue with the unexpanded analysis
  — this stage is recoverable

##### Edge Cases
- No catalog term matches a given attribute → the original value is preserved unchanged;
  forced mapping to a poor catalog term is worse than no mapping
- Expansion returns a category that does not exist in the catalog → treated as if
  expansion for that field failed; original value used

---

#### Stage 3 — Three-Layer Retrieval

##### Problem Statement
No single retrieval strategy covers all failure modes against this catalog. Structured
filtering misses products outside the detected category. BM25 misses synonyms. Vector
search requires pre-computation infrastructure. Running all three in parallel and fusing
results gives the critic the strongest possible candidate set.

L1 (Category A: Without Embeddings) and L2 (Category A: Without Embeddings) use
different indexes on the same Atlas collection — independent at the retrieval mechanism
level, though their candidate sets can overlap. L3 (Category B: With Embeddings) uses
a separate local mirror. Overlap across any layers is not harmful — a product appearing
in multiple layers receives a higher RRF score, which is the intended signal.

**Execution order**: L3 starts immediately after Stage 1 using the original unexpanded
analysis, running in parallel with Stage 2 (expansion) and the subsequent L1/L2 calls.
L1 and L2 wait for Stage 2 to complete; L3 does not.

##### Acceptance Criteria
- [ ] All enabled layers SHALL run in parallel
- [ ] Candidate count per layer SHALL be admin-configurable (default 50, range 10–200)
- [ ] Each layer SHALL be independently toggleable via the admin panel for diagnostic
  purposes
- [ ] GIVEN L3 is unavailable (mirror not yet populated or sync in progress), THEN L1
  and L2 SHALL run without interruption and `l3Available: false` SHALL be noted in
  the response
- [ ] Price range filtering SHALL be applied in all layers when `price_range` is non-null
- [ ] WHEN `price_range` is non-null but no candidates are found with the price filter
  applied, THEN the filter SHALL be dropped and retrieval re-run without it;
  `priceFilterRelaxed: true` SHALL be set in the response meta

---

**L1 — ESR Compound Index Filter on Atlas (Category A: Without Embeddings)**

Uses the `category_1_type_1_price_1` compound index directly — no text search. Returns
products that structurally match the detected category, type, and optional price range.

ESR application rules:
- **E** `category` — applied first if `confidence > categoryConfidenceThreshold`
  (default 7, range 1–10)
- **E** `type` — applied second only when `category` is also active (cannot skip the
  index prefix — applying `type` without `category` forces a full index scan)
- **R** `price` — applied last only when `price_range` is non-null

L1 uses the **expanded** `FurnitureAnalysis` for category and type values, since these
must match catalog vocabulary exactly for index equality filters to hit. Results within
the matched set are ordered by price ascending.

---

**L2 — Description Template Match via BM25 on Atlas (Category A: Without Embeddings)**

Reconstructs the catalog's own description sentence pattern from the **expanded**
`FurnitureAnalysis` and searches the `title_text_description_text` BM25 index with it.
Since catalog descriptions follow a strict template, this construction matches exact
phrases in the inverted index that a freeform semantic query string misses.

Template format:
```
`${color} ${style} ${type} made from premium ${material}.
 This ${category} piece is ${feature}.
 Perfect for adding character to your home.`
```

The `feature` placeholder is populated using one of two strategies in order of
preference:
1. **Distinct value lookup** — query distinct description phrases for the detected
   category using a targeted regex against known patterns ("featuring easy-to-assemble
   construction", "with hidden storage compartments", etc.)
2. **Fast LLM fallback** (Gemini Flash) — if regex extraction returns no matches, a
   minimal prompt generates one plausible feature phrase consistent with catalog style

Boilerplate phrases present in every description ("Perfect for adding character to your
home") are excluded from the search string — they have near-zero IDF and contribute
nothing to BM25 scoring.

ESR post-filter applied after `$text` scan, using the same rules as L1.

> **Atlas constraint**: when `$text` and the compound index appear in the same query,
> MongoDB uses `$text` to drive the scan and applies the compound index as a
> post-filter — not a pre-filter. At 1M+ products, `$text` traverses the full postings
> list before compound filtering narrows the result. This is a fundamental MongoDB
> behaviour, not a configuration issue, and is the architectural reason the local mirror
> exists.

---

**L3 — Vector Search on Local Mirror (Category B: With Embeddings)**

Queries the `product_embeddings` collection using `$vectorSearch` with an HNSW index.
Requires the local mirror to be populated and `embeddingsReady: true`.

The query vector is the Gemini `text-embedding-004` embedding of a **prose
reconstruction** of the original (unexpanded) `FurnitureAnalysis` — not raw JSON.
Embedding models are trained on natural prose; structured JSON produces lower-quality
vectors.

Example query prose:
```
"Corner Wardrobe. Wardrobes. Contemporary mid-century modern style.
 Engineered wood and chrome metal construction. Espresso brown with
 chrome silver hardware. Large corner unit with hanging storage."
```

`numCandidates` is set to `L3CandidateCount × 3` to give the HNSW index sufficient
exploration budget. Category and price filters are applied at the vector index level
when confidence thresholds are met.

**Embedding model constraint**: both catalog pre-computation and per-request query
embedding use Gemini `text-embedding-004` exclusively. Mixing embedding models produces
incomparable vectors — cosine similarity is meaningless across different embedding
spaces. If Gemini embedding is unavailable, L3 is skipped for that request rather than
falling back to a different provider.

---

**RRF Fusion**

After all enabled layers return, results are fused using Reciprocal Rank Fusion:
```
rrfScore(product) = Σ 1 / (k + rank_in_layer)   for each layer the product appears in
```

Default `k = 60`, admin-configurable. Products sorted by RRF score descending.

`hitCount` and `layers` are carried forward as first-class fields — surfaced in the
critic prompt, the result card UI, and the eval log.

```typescript
interface FusedCandidate {
  productId: string;
  rrfScore:  number;
  hitCount:  number;              // 1, 2, or 3
  layers:    ('L1' | 'L2' | 'L3')[];
}
```

RRF is chosen over weighted sum because structured-filter, BM25, and cosine similarity
scores live on different scales. Normalising them introduces its own distortions. RRF
uses only rank position, which is scale-invariant.

##### Edge Cases
- All three layers return zero candidates → 422 `NO_MATCHES_FOUND` before critic
- A product appears in all three layers at high rank → RRF score is
  substantially higher; this is intentional and correct
- Category confidence below threshold → equality filter dropped from L1 and post-filter
  in L2; search broadens automatically

---

#### Stage 4 — Critic Evaluation

##### Problem Statement
Structured, lexical, and semantic similarity are mathematical signals with no
understanding of whether a product is actually a good match. A dark oak single-door
wardrobe may score high on cosine similarity against a corner wardrobe query simply
because the embedding space is compressed. A second LLM pass with the original image
and query anchors the final ranking in genuine visual and semantic relevance.

##### Acceptance Criteria
- [ ] The critic SHALL receive: the original image, the user query, a summary of the
  merged analysis, the top-N fused candidates as structured text, and each candidate's
  `hitCount` and `layers`
- [ ] Candidate count sent to the critic SHALL be admin-configurable (default 10,
  range 10–50) — this cap is a hard constraint; fitting 200 candidates into a single
  LLM context is not reliable at scale
- [ ] The critic prompt SHALL include a calibration anchor: at most 2 products should
  score 9–10 per search; a score of 7 means genuinely good match
- [ ] Products scoring below `minCriticScore` (default 5, admin-configurable) SHALL
  be filtered from the final results
- [ ] GIVEN the critic call fails, THEN results SHALL be returned ranked by RRF score
  only, with a UI banner noting that relevance scoring was unavailable
- [ ] Final results returned SHALL not exceed `maxResults` (default 10,
  admin-configurable)

##### Domain Model
```typescript
const CriticResultSchema = z.object({
  product_id:  z.string(),
  score:       z.number().min(1).max(10),
  explanation: z.string().max(120),
});

const CriticResponseSchema = z.object({
  results: z.array(CriticResultSchema),
});
```

##### Edge Cases
- Critic returns malformed JSON → retry once with stricter prompt → fall back to
  RRF ranking with banner
- All candidates score below `minCriticScore` → return best candidate with "low
  confidence" badge rather than an empty screen
- Critic scores all candidates identically (score compression) → calibration anchor in
  prompt mitigates this; admin can inspect via eval log

---

### F5 — Search Intent Panel

#### Problem Statement
Users cannot diagnose why results are poor if they cannot see what the system searched
for. The intent panel closes this gap — making the pipeline's interpretation of the
image and query fully transparent and always visible.

#### User Stories
- As a user, I want to see what the system is searching for above the results so I can
  understand and correct it if it got something wrong.
- As a user, I want to know when my text query had no effect on the results so I can
  try rephrasing.

#### Acceptance Criteria
- [ ] WHEN a search completes, THEN the intent panel SHALL be visible above the
  results — always expanded, not collapsed by default
- [ ] The panel SHALL show a one-sentence natural language summary of the search
- [ ] The panel SHALL display detected attributes grouped by source, each with its
  confidence score
- [ ] WHEN `price_range` is non-null, THEN it SHALL be prominently displayed with its
  source noted ("from your query" or "from image")
- [ ] The panel SHALL display the vocabulary expansion terms used
- [ ] WHEN `queryInfluence.affected = false`, THEN an inline warning SHALL be shown:
  *"Your query didn't change the results — try rephrasing or using more specific terms"*
- [ ] WHEN L3 was unavailable during the search, THEN the panel SHALL note
  *"Semantic search unavailable — results based on keyword and structured matching only"*

#### Domain Model
- **QueryInfluence**: `{ affected: boolean, reason: 'no_intent_extracted' |
  'identical_results' | 'affected' | 'no_query' }`

Query influence is detected via two triggers:
1. Stage 1 returned empty arrays for all fields and null for all singular fields
2. Top-5 result IDs are identical to a shadow query run with L1 + L2 using vision-derived
   inputs only (no user text query terms). The shadow query is a MongoDB-only call — no
   additional LLM. It adds one L1 + L2 retrieval round-trip per request; at p95 this is
   expected to be under 200ms at 1M products and is tracked explicitly in the performance
   budget.

#### Edge Cases
- Shadow query fails → influence detection defaults to `affected: true` to avoid
  a false warning
- User submits image only with no query → `reason: 'no_query'`, no warning shown

---

### F6 — Results Display

#### Problem Statement
Users need enough information per result to make a purchase decision, plus enough
transparency to understand why each result was returned.

#### User Stories
- As a user, I want to see ranked results with product name, category, type, price,
  and dimensions so I can make a quick decision.
- As a user, I want to understand why each result was returned so I can trust it.

#### Acceptance Criteria
- [ ] Each result card SHALL display: title, category, type, price, dimensions,
  critic score (1–10), critic explanation, layer hit badges (L1 / L2 / L3)
- [ ] Critic score SHALL be visually prominent — the primary visual hierarchy element
  on each card
- [ ] Layer hit badges SHALL be shown on each card indicating which layers returned
  that product
- [ ] A product appearing in all 3 layers SHALL display a "strong multi-signal match"
  indicator
- [ ] Each card SHALL contain a collapsed debug panel with the full `FurnitureAnalysis`
  attributes
- [ ] WHEN all critic scores are below `minCriticScore`, THEN the best candidate SHALL
  be shown with a "low confidence" badge — never an empty screen
- [ ] WHEN zero candidates were found across all layers, THEN a `NO_MATCHES_FOUND`
  state SHALL be shown with guidance to try a different image or query
- [ ] WHEN the guardrail failed, THEN a full-screen illustrated state SHALL be shown
  with the `detected_subject` in the message

#### Edge Cases
- Critic unavailable → results shown ranked by RRF score, with banner noting scoring
  was skipped
- Single result returned → display normally, no "top result" framing that implies
  comparison

---

### F7 — Admin Page

#### Problem Statement
Retrieval quality depends on parameters that need tuning without code changes. The admin
page exposes all behaviorally significant configuration as a single back-office surface.

#### User Stories
- As an admin, I want to configure Gemini and OpenAI API keys in one place so the
  system works for all users without per-user key entry.
- As an admin, I want to tune retrieval parameters without touching code.
- As an admin, I want to enable or disable individual retrieval layers to diagnose
  which layer contributes to result quality.
- As an admin, I want to see the mirror sync status and trigger a manual re-sync.
- As an admin, I want to view recent search sessions with critic score distributions
  to monitor quality trends over time.

#### Acceptance Criteria
- [ ] All admin configuration SHALL be persisted to local MongoDB and survive server
  restarts
- [ ] API key inputs SHALL render as masked password fields with a "Test connection"
  button per key that validates with a minimal provider API call
- [ ] Layer toggles (L1, L2, L3) SHALL take effect immediately on the next search —
  no restart required
- [ ] The mirror status panel SHALL show live counts from both Atlas and the local
  mirror with a sync status indicator
- [ ] WHEN `mirrorProductCount` differs from `catalogProductCount`, THEN a visual
  warning SHALL be shown with a "Force re-sync" action
- [ ] The evaluation log panel SHALL show the last 20 search sessions in a table

#### Domain Model

**AdminConfig**:

| Field | Type | Default | Range | Notes |
|---|---|---|---|---|
| `geminiKey` | `string \| null` | null | — | Persisted to local MongoDB |
| `openaiKey` | `string \| null` | null | — | Persisted to local MongoDB |
| `preferredProvider` | enum | `'auto'` | `gemini \| openai \| auto` | `auto` = Gemini with OpenAI fallback |
| `L1CandidateCount` | number | 50 | 10–200 | Candidates from compound index filter |
| `L2CandidateCount` | number | 50 | 10–200 | Candidates from BM25 template match |
| `L3CandidateCount` | number | 50 | 10–200 | Candidates from vector search |
| `criticCandidateCount` | number | 10 | 10–50 | Top fused candidates sent to critic |
| `maxResults` | number | 10 | 1–25 | Final results shown to user |
| `rrfK` | number | 60 | 1–200 | RRF damping constant |
| `minCriticScore` | number | 5 | 1–10 | Minimum score to include in results |
| `overallConfidenceThreshold` | number | 4 | 1–10 | Below this, 422 `LOW_CONFIDENCE` returned |
| `categoryConfidenceThreshold` | number | 7 | 1–10 | Below this, category filter dropped from L1 and L2 |
| `typeConfidenceThreshold` | number | 7 | 1–10 | Below this, type filter dropped |
| `guardrailConfidenceThreshold` | number | 6 | 1–10 | Below this, 422 `NOT_FURNITURE` returned |
| `vocabularySampleSize` | number | 200 | 50–1000 | Products sampled for style/material/color extraction |
| `enableL1` | boolean | true | — | Layer toggle |
| `enableL2` | boolean | true | — | Layer toggle |
| `enableL3` | boolean | true | — | Auto-disabled if mirror unavailable |

#### Out of Scope
- Authentication or session management
- Multi-admin concurrency control

---

### F8 — Evaluation Logging

#### Problem Statement
Understanding why the system performs well or poorly on specific queries requires a
complete record of every pipeline run — not just the final results. The eval log
captures full pipeline context for offline quality analysis without impacting the
read-only Atlas catalog.

#### Acceptance Criteria
- [ ] WHEN a search completes (successfully or with a partial failure), THEN a log
  entry SHALL be written to local MongoDB `eval_logs`
- [ ] Logging failures SHALL be silent — they SHALL never block or delay the search
  response
- [ ] Raw image bytes SHALL never be stored — only a SHA-256 hash of the image
- [ ] The log SHALL capture: guardrail result, full analysis, expansion, per-layer
  candidate counts, all critic scores and explanations, provider used, whether fallback
  was triggered, and total duration

#### Domain Model
```typescript
interface EvalLogDocument {
  _id:        ObjectId;
  timestamp:  Date;
  image_hash: string;

  user_query: string | null;

  guardrail: {
    is_furniture:     boolean;
    confidence:       number;
    detected_subject: string;
  };

  analysis:          FurnitureAnalysis;  // unified vision + query output
  expanded_analysis: FurnitureAnalysis;  // post-expansion, catalog-grounded

  retrieval: {
    l1_count:     number;
    l2_count:     number;
    l3_count:     number;
    fused_count:  number;
    l3_available: boolean;
  };

  results: Array<{
    product_id:         string;
    product_title:      string;
    rrf_score:          number;
    hit_count:          number;
    layers:             string[];
    critic_score:       number;
    critic_explanation: string;
  }>;

  results_shown:      number;
  provider_used:      'gemini' | 'openai';
  fallback_triggered: boolean;
  duration_ms:        number;
}
```

#### Edge Cases
- Local MongoDB unavailable → log write fails silently; `/api/health` reports
  `evalDbConnected: false`; search pipeline is unaffected

---

## Data Architecture

### Atlas Catalog (read-only)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `title` | string | |
| `description` | string | |
| `category` | string | |
| `type` | string | |
| `price` | number | USD |
| `width` | number | cm |
| `height` | number | cm |
| `depth` | number | cm |

**Indexes** (existing — cannot be modified or extended):

| Name | Type | Keys / Weights | Used by |
|---|---|---|---|
| `_id_` | Default | `{ _id: 1 }` | All queries |
| `title_text_description_text` | `$text` (BM25) | title × 2, description × 1 | L2 |
| `category_1_type_1_price_1` | Compound | `{ category: 1, type: 1, price: 1 }` | L1 (primary), L2 (post-filter) |

> **Atlas constraint**: a vector index cannot be added to this collection — this is the
> primary architectural reason the local mirror exists. When `$text` and the compound
> index appear in the same L2 query, MongoDB uses `$text` to drive the scan and applies
> the compound index as a post-filter — not a pre-filter. The compound index cannot
> pre-filter the `$text` scan at the storage engine level. At 1M+ products, `$text`
> traverses the full postings list before compound filtering narrows the result.

---

### Local MongoDB (writable, docker-compose)

**Collection: `product_embeddings`**

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `product_id` | string | Atlas `_id` as string — foreign key |
| `category` | string | Duplicated from Atlas for vector filter |
| `type` | string | Duplicated from Atlas for vector filter |
| `price` | number | Duplicated from Atlas for vector filter |
| `embedding` | number[] | 768-dim, Gemini `text-embedding-004` exclusively |
| `embedded_text` | string | Prose string that was embedded, for debugging |
| `created_at` | Date | |
| `updated_at` | Date | |

**Indexes**:

| Name | Type | Notes |
|---|---|---|
| `{ product_id: 1 }` | Unique | Supports change stream upserts and existence checks |
| `{ category: 1, price: 1 }` | Compound | Supports vector filter pre-conditions; `type` omitted — `category + price` covers the most common filter combinations |
| vector index on `embedding` | HNSW, cosine, 768 dims | Filter fields: `category`, `price`. **Gemini `text-embedding-004` only** — mixing models invalidates cosine similarity across the entire index |

---

**Collection: `catalog_vocabulary`** (single document, `_id: 'singleton'`)

| Field | Type | Notes |
|---|---|---|
| `categories` | string[] | Distinct values from Atlas `products.category` |
| `types` | string[] | Distinct values from Atlas `products.type` |
| `styles` | string[] | Extracted from titles via regex or Gemini Flash |
| `materials` | string[] | Extracted from "made from premium X" pattern |
| `colors` | string[] | Extracted from description color terms |
| `refreshedAt` | Date | |

No indexes — single document, always fetched by `_id`. Style, material, and color terms
are extracted from a sample of products (default 200, admin-configurable via
`vocabularySampleSize`). Catalog descriptions follow a strict formulaic template, so the
default sample reliably covers all distinct pattern permutations.

---

**Collection: `admin_config`** (single document, `_id: 'config'`)

Stores the `AdminConfig` object. Loaded into server memory on startup; written on every
admin update. API keys are stored encrypted at rest.

No indexes — single document, always fetched by `_id`.

---

**Collection: `eval_logs`**

| Index | Notes |
|---|---|
| `{ timestamp: -1 }` | Admin panel time-series queries, recent session display |
| `{ image_hash: 1, timestamp: -1 }` | Deduplication, repeat query analysis |
| `{ "results.critic_score": 1 }` | Low-quality session queries, quality trend analysis |

---

**Collection: `mirror_meta`** (single document, `_id: 'sync_state'`)

| Field | Type | Notes |
|---|---|---|
| `change_stream_resume_token` | object \| null | Persisted after every change event |
| `last_full_sync` | Date \| null | Set after startup reconciliation completes |
| `last_vocabulary_refresh` | Date \| null | |

No indexes — single document, always fetched by `_id`.

---

## Catalog Mirror Sync Strategy

### Startup Sequence

1. Connect to local MongoDB — if unavailable, fail hard (search is not possible
   without the eval DB and mirror infrastructure)
2. Load `admin_config` — populate in-memory `AdminConfig`
3. Load `catalog_vocabulary` — if absent or older than 24 hours, re-extract from Atlas
4. Load `mirror_meta` resume token
5. Count reconciliation: compare Atlas `products` count vs local `product_embeddings`
   count. If counts differ, fetch the missing `_id` delta from Atlas, embed and store
6. Set `embeddingsReady: true` — L3 becomes available for search
7. Start change stream with resume token — real-time sync begins

### Real-Time Sync (Change Streams)

Change streams are opened on the read-only Atlas `products` collection. A read-only
credential is sufficient — change streams consume the oplog, not write permissions.

| Event | Action |
|---|---|
| `insert` | Embed new product, insert into `product_embeddings` |
| `update` / `replace` | Re-embed, upsert by `product_id` |
| `delete` | Remove from `product_embeddings` by `product_id` |

Resume token is persisted to `mirror_meta` after every event. On stream error:
reconnect with exponential backoff (2s, 4s, 8s), resuming from the last persisted
token. If the token has expired (oplog window exceeded), run count reconciliation and
restart the stream without a resume token.

### Vocabulary Refresh

Vocabulary is re-extracted when absent, older than 24 hours, or manually triggered via
the admin panel. `category` and `type` distinct values are queried directly from Atlas
(fast, index-resident). Style, material, and color terms are extracted from a product
sample (size admin-configurable, default 200) using a combination of regex patterns
against the known description format and a Gemini Flash call for terms that do not match
known patterns.

---

## Provider Strategy

### Model Roles

| Role | Stage / Layer | Primary | Fallback | Notes |
|---|---|---|---|---|
| Guardrail | Stage 0 | Gemini Flash | GPT-4o-mini | Binary output, cheapest multimodal |
| Vision + Query | Stage 1 | Gemini 1.5 Pro | GPT-4o | Image + text, single call |
| Vocabulary expansion | Stage 2 | Gemini Flash | GPT-4o-mini | Text only, lightweight |
| Feature phrase | L2 | Gemini Flash | GPT-4o-mini | Fallback only when regex fails |
| Critic | Stage 4 | Gemini 1.5 Pro | GPT-4o | Image + long context |
| Embedding | L3 | Gemini `text-embedding-004` | **No fallback** | Model must match pre-computed index |

### Fallback Rules

**Triggers**: HTTP 429, 402, 500, 502, 503
**No fallback on**: HTTP 400, 401, content policy violations

**Embedding exception**: The embedding model does not fall back to OpenAI. If Gemini
embedding is unavailable, L3 is skipped for that request. The `product_embeddings`
index was built with Gemini vectors and cosine similarity is only valid within the same
embedding space. Writing OpenAI vectors to the same index would silently corrupt all
future search results.

---

## API Contract

### POST /api/match

**Request**: `multipart/form-data`
- `image`: File (optional, JPEG/PNG/WebP, max 10MB)
- `userQuery`: string (optional, max 500 chars)

**Headers**:
- `x-gemini-key`: user-supplied Gemini API key (optional — admin key used if absent)
- `x-openai-key`: user-supplied OpenAI API key (optional — used only as fallback
  provider key)

**Response 200**:
```typescript
interface MatchResponse {
  queryId: string;

  searchIntent: {
    summary:          string;
    analysis:         FurnitureAnalysis;  // unified vision + query output
    expandedAnalysis: FurnitureAnalysis;  // catalog-grounded expansion
    queryInfluence: {
      affected: boolean;
      reason:   'no_intent_extracted' | 'identical_results' | 'affected' | 'no_query';
    };
    l3Available: boolean;
  };

  results: Array<{
    product:           Product;
    criticScore:       number;
    criticExplanation: string;
    hitCount:          number;
    layers:            ('L1' | 'L2' | 'L3')[];
    rrfScore:          number;
  }>;

  meta: {
    candidatesConsidered: number;
    resultsShown:         number;
    durationMs:           number;
    priceFilterRelaxed:   boolean;  // true when price filter was dropped due to zero results
    providerUsed:         'gemini' | 'openai';
    fallbackTriggered:    boolean;
  };
}
```

**Error responses**:

| Status | Code | Condition |
|---|---|---|
| 400 | `MISSING_INPUT` | Neither image nor query provided |
| 401 | `INVALID_KEY` | API key missing, invalid, or expired |
| 422 | `NOT_FURNITURE` | Guardrail confidence below threshold, or text-only query is off-domain |
| 422 | `NO_MATCHES_FOUND` | Zero candidates from all enabled layers |
| 422 | `LOW_CONFIDENCE` | Vision `overall_confidence` below `overallConfidenceThreshold` |
| 503 | `CATALOG_UNAVAILABLE` | Atlas connection failed |
| 502 | `PROVIDER_UNAVAILABLE` | All configured providers failed |

### Supporting Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | System status, embedding readiness, sync state |
| GET | `/api/admin/config` | Read current admin configuration |
| PATCH | `/api/admin/config` | Update admin configuration (partial updates accepted) |
| GET | `/api/admin/evaluations` | Recent eval log sessions (last 20) |
| POST | `/api/admin/sync` | Trigger manual full re-sync of local mirror |
| POST | `/api/admin/refresh-vocabulary` | Re-extract catalog vocabulary from Atlas |

**GET /api/health response**:
```typescript
interface HealthResponse {
  status:                'ok' | 'degraded';
  catalogConnected:      boolean;
  evalDbConnected:       boolean;
  mirrorSyncStatus:      'synced' | 'syncing' | 'stale' | 'error';
  mirrorProductCount:    number;
  catalogProductCount:   number;
  changeStreamConnected: boolean;
  embeddingsReady:       boolean;
}
```

Frontend polls `/api/health` on load. Search is available as soon as
`catalogConnected: true`. L3 auto-enables when `embeddingsReady: true`.

---

## Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| End-to-end wall clock (p95) | < 8s |
| L1 + L2 Atlas queries at 2,500 products | < 100ms |
| L1 + L2 Atlas queries at 1M products | < 300ms |
| L3 vector search at 1M products | < 50ms |
| RRF fusion (up to 600 candidates) | < 1ms |
| Shadow query (influence detection, p95) | < 200ms at 1M products |
| Startup embedding at 2,500 products | < 60s |

### Scalability

- `IRetrievalService` interface isolates each retrieval layer — any layer can be swapped
  or replaced independently without touching pipeline logic above it
- L3 scales to 10M+ products via HNSW without architectural change
- L1 and L2 scale with Atlas horizontal scaling — no application-level changes required

### Security

- User API keys: ephemeral only — React state. Never logged, never persisted
- Admin API keys: persisted to local MongoDB, encrypted at rest. Never logged
- Raw image bytes: never stored — only SHA-256 hash written to eval log
- Atlas connection: read-only by construction — no writes are architecturally possible

### Reliability

| Failure | Behaviour |
|---|---|
| Stage 2 (vocabulary expansion) fails | Pipeline continues with unexpanded analysis |
| Stage 4 (critic) fails | Results returned ranked by RRF, with UI banner |
| L3 unavailable | L1 + L2 run; `l3Available: false` noted in response |
| Eval log write fails | Silent — pipeline unaffected |
| Atlas unavailable | Hard failure — 503 returned |
| Local MongoDB unavailable on startup | Hard failure — service does not start |
| Shadow query fails | Influence detection defaults to `affected: true` |
| Price filter yields zero results | Filter dropped; `priceFilterRelaxed: true` in response meta |

---

## Key Design Choices

| Choice | Reason |
|---|---|
| Local mirror exists | Atlas is read-only with no vector index |
| Three retrieval layers | Structured, lexical, and semantic each catch failure modes the others miss |
| RRF fusion | Structured-filter, BM25, and cosine scores are not on the same scale |
| Unified `FurnitureAnalysisSchema` | Vision and query produce the same shape; query is injected at higher significance into the same LLM call |
| Gemini-only for embeddings | Model consistency is a correctness constraint — mixing models invalidates cosine similarity |
| Price filtering requires user query | Images carry no reliable price signal |
| Admin config persisted to MongoDB | Local MongoDB is already in scope; avoids per-restart reconfiguration |
| L1 uses compound index only (no BM25) | Makes L1 and L2 independent at the retrieval mechanism level — different indexes, different failure modes |

---

## Tradeoffs

| Tradeoff | Impact |
|---|---|
| L3 partial coverage during initial embedding job | L1 + L2 only until sync completes |
| Critic candidate cap | Limits recall at high fused set sizes |
| Change stream resume token gap risk | Extended outages may require full count reconciliation |
| Shadow query adds one retrieval round-trip per request | ~200ms p95; accepted for query influence accuracy |
| L1 and L2 share the same Atlas collection | Not truly independent data sources — independence comes from different retrieval mechanisms (compound index vs BM25), not different storage |

---

## Future Enhancements

1. Atlas Vector Search migration (`IRetrievalService` swap, no pipeline changes)
2. User feedback (thumbs up/down) written to eval log as fine-tuning signal
3. Admin A/B layer toggling with automated quality scoring comparison
4. Multi-item image support (detect and crop individual pieces before analysis)
5. Catalog enrichment pipeline (richer descriptions improve L3 embedding quality)
6. Incremental vocabulary refresh triggered by change stream insert events
