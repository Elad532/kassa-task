# F4 — Matching Pipeline Architecture

## Table of Contents

- [Standard Path (Image + Query)](#standard-path-image--query)
- [Text-Only Path (Query Only)](#text-only-path-query-only)
- [Stage 3 Retrieval Layers](#stage-3-retrieval-layers)
- [RRF Fusion](#rrf-fusion)

---

## Standard Path (Image + Query)

```mermaid
sequenceDiagram
    participant Client
    participant API as POST /api/match
    participant S0G as Stage 0<br/>Guardrail (Flash)
    participant S0V as Stage 0<br/>Vision (Pro)
    participant S1 as Stage 1<br/>FurnitureAnalysis
    participant S2 as Stage 2<br/>VocabularyExpansion
    participant L1 as L1<br/>Compound Index
    participant L2 as L2<br/>BM25 Template
    participant L3 as L3<br/>Vector Search
    participant RRF as RRF Fusion
    participant S4 as Stage 4<br/>Critic (Pro)

    Client->>API: image + query + gemini-key
    API->>S0G: guardrail prompt (Flash)
    API->>S0V: image + query (Pro) — fires simultaneously

    alt guardrail fails (is_furniture=false OR confidence < threshold)
        S0G-->>API: NOT_FURNITURE
        API-->>Client: 422 NOT_FURNITURE
    else guardrail call itself errors
        S0G-->>API: error
        API-->>Client: 502 VALIDATION_FAILED
    end

    alt vision call fails
        S0V-->>API: error
        API-->>Client: 502 VISION_FAILED
    end

    S0G-->>S1: guardrail passed
    S0V-->>S1: FurnitureAnalysis (raw)

    S1->>S1: validate via FurnitureAnalysisSchema

    alt overall.confidence < overallConfidenceThreshold
        S1-->>API: LOW_CONFIDENCE
        API-->>Client: 422 LOW_CONFIDENCE
    end

    Note over S2,L3: L3 fires immediately after Stage 1 — does NOT wait for Stage 2.<br/>Stage 2 runs in parallel with L3.

    S1->>S2: FurnitureAnalysis (original)
    S1->>L3: FurnitureAnalysis (original, unexpanded)

    S2->>S2: expand terms → catalog vocabulary (Gemini Flash)
    S2-->>L1: FurnitureAnalysis (expanded)
    S2-->>L2: FurnitureAnalysis (expanded)

    L1->>L1: ESR compound index query on Atlas
    L2->>L2: BM25 template match on Atlas
    L3->>L3: $vectorSearch on local mirror (HNSW)

    L1-->>RRF: ranked product_ids
    L2-->>RRF: ranked product_ids
    L3-->>RRF: ranked product_ids

    alt all layers return zero candidates
        RRF-->>API: NO_MATCHES_FOUND
        API-->>Client: 422 NO_MATCHES_FOUND
    end

    RRF->>RRF: rrfScore = Σ 1/(k + rank) per layer

    RRF-->>S4: top-N FusedCandidates (product details + hitCount + layers)
    S4->>S4: score each candidate 1–10 (Pro Vision)

    alt critic call fails
        S4-->>API: fallback — use RRF order
        API-->>Client: 200 results (RRF order) + relevanceScoringUnavailable: true
    end

    S4-->>API: CriticResponse (scored + filtered)
    API-->>Client: 200 MatchResponse
```

---

## Text-Only Path (Query Only)

```mermaid
sequenceDiagram
    participant Client
    participant API as POST /api/match
    participant S0T as Stage 0<br/>Text Guardrail (Flash)
    participant S1 as Stage 1<br/>FurnitureAnalysis
    participant S2 as Stage 2<br/>VocabularyExpansion
    participant L1 as L1<br/>Compound Index
    participant L2 as L2<br/>BM25 Template
    participant L3 as L3<br/>Vector Search
    participant RRF as RRF Fusion
    participant S4 as Stage 4<br/>Critic (Flash)

    Client->>API: query only (no image) + gemini-key
    API->>S0T: is this furniture-related? (Flash)

    alt query is off-domain
        S0T-->>API: NOT_FURNITURE
        API-->>Client: 422 NOT_FURNITURE
    end

    S0T-->>S1: text guardrail passed
    S1->>S1: text-only analysis — no vision call<br/>FurnitureAnalysis from query alone

    alt overall.confidence < overallConfidenceThreshold
        S1-->>API: LOW_CONFIDENCE
        API-->>Client: 422 LOW_CONFIDENCE
    end

    Note over S2,L3: Same parallel execution as standard path from here onward.

    S1->>S2: FurnitureAnalysis (original)
    S1->>L3: FurnitureAnalysis (original, unexpanded)

    S2-->>L1: FurnitureAnalysis (expanded)
    S2-->>L2: FurnitureAnalysis (expanded)

    L1-->>RRF: ranked product_ids
    L2-->>RRF: ranked product_ids
    L3-->>RRF: ranked product_ids

    RRF->>RRF: rrfScore = Σ 1/(k + rank) per layer
    RRF-->>S4: top-N FusedCandidates
    S4-->>API: CriticResponse
    API-->>Client: 200 MatchResponse
```

---

## Stage 3 Retrieval Layers

```mermaid
flowchart TD
    ANA["FurnitureAnalysis\n(Stage 1 output)"]

    ANA -->|"original — no expansion"| L3_PROSE["reconstructProse(analysis)\nNatural language, no JSON syntax"]
    ANA -->|"expanded via Stage 2"| L1_FILTER["L1: ESR Compound Filter\ncategory_1_type_1_price_1"]
    ANA -->|"expanded via Stage 2"| L2_TMPL["L2: BM25 Template Match\ntitle_text + description_text"]

    L3_PROSE --> L3_EMBED["Gemini text-embedding-004\n768-dim float vector"]
    L3_EMBED --> L3_VS["$vectorSearch\nindex: embedding_hnsw\nnumCandidates = limit × 3"]

    L1_FILTER --> L1_ESR{"ESR rules\ncategory confidence ≥ threshold?"}
    L1_ESR -- "yes" --> L1_CAT["E: category =\nexact match"]
    L1_ESR -- "no" --> L1_SKIP["category dropped\nfull scan"]
    L1_CAT --> L1_TYPE{"type confidence ≥ threshold?"}
    L1_TYPE -- "yes" --> L1_T["E: type = exact match"]
    L1_TYPE -- "no" --> L1_PONLY["skip type\nprice filter only"]

    L2_TMPL --> L2_BUILD["Build template:\ncolor style type made from premium material.\nThis category piece is feature."]
    L2_BUILD --> L2_FEAT{"distinct regex\nextraction"}
    L2_FEAT -- "match found" --> L2_TX["$text search on Atlas"]
    L2_FEAT -- "no match" --> L2_LLM["Gemini Flash\nfeature phrase fallback"]
    L2_LLM --> L2_TX

    L1_T --> RRF["RRF Fusion"]
    L1_PONLY --> RRF
    L1_SKIP --> RRF
    L2_TX --> RRF
    L3_VS --> RRF
```

---

## RRF Fusion

```mermaid
flowchart LR
    L1R["L1 results\n[p1, p3, p7, ...]"]
    L2R["L2 results\n[p3, p1, p5, ...]"]
    L3R["L3 results\n[p7, p3, p1, ...]"]

    L1R --> SCORE["rrfScore(p) = Σ 1/(k + rank)\nfor each layer containing p\ndefault k = 60"]
    L2R --> SCORE
    L3R --> SCORE

    SCORE --> SORT["Sort by rrfScore DESC"]

    SORT --> FC["FusedCandidate[]\n{ productId, rrfScore,\n  hitCount, layers }"]

    FC --> TOPN["Top-N to Critic\n(default 10, admin-configurable)"]
```
