# Stage 2 (Vocabulary Expansion) + Stage 3 L3 (Vector Search) Architecture

## Table of Contents

- [Stage 2 — Vocabulary Expansion Flow](#stage-2--vocabulary-expansion-flow)
- [Stage 3 L3 — Vector Search Flow](#stage-3-l3--vector-search-flow)
- [Local Mirror Data Models](#local-mirror-data-models)
- [NestJS Module Dependency Graph](#nestjs-module-dependency-graph)

---

## Stage 2 — Vocabulary Expansion Flow

```mermaid
flowchart TD
    IN["FurnitureAnalysis\n(Stage 1 output)"]

    IN --> VOCAB["VocabularyService.getVocabulary()\nReads singleton from local MongoDB\nRefreshes if absent or stale"]

    VOCAB --> EXPAND["VocabularyExpansionService.expand(analysis, vocabulary)"]

    EXPAND --> CHECK{"All terms already\nin vocabulary?\n(case-insensitive)"}
    CHECK -- "yes" --> SAME["Return analysis unchanged\n(no LLM call)"]
    CHECK -- "no" --> BATCH["Batch non-matching terms\ninto one Gemini Flash call\nwithStructuredOutput(MappingSchema)"]

    BATCH --> MAP["Reconstruct FurnitureAnalysis\nwith mapped values"]
    MAP --> OUT["FurnitureAnalysis (expanded)\nexpansion_complete event"]
    SAME --> OUT2["FurnitureAnalysis (unchanged)\nexpansion_complete event"]

    OUT --> L1["L1: Compound Index Filter"]
    OUT --> L2["L2: BM25 Template Match"]
    OUT2 --> L1
    OUT2 --> L2
```

---

## Stage 3 L3 — Vector Search Flow

```mermaid
flowchart TD
    IN["FurnitureAnalysis\n(Stage 1 original — NOT expanded)"]

    IN --> PROSE["EmbeddingsService.reconstructProse(analysis)\nFurniture type. Category. Styles. Materials construction. Colors.\nNo JSON syntax or 'confidence' word"]

    PROSE --> EMBED["Gemini text-embedding-004\n768-dim float vector"]

    EMBED --> VS["$vectorSearch aggregation\nindex: embedding_hnsw\nnumCandidates: limit × 3"]

    VS --> FILTER{"Optional pre-filters\n(applied as MQL filter\nbefore vector search)"}
    FILTER --> CATF["category: string\n(from analysis.category.value\nif confidence ≥ threshold)"]
    FILTER --> PRICEF["price: range\n(from analysis.price_range\nif non-null)"]

    VS --> RESULT["product_id[]\nin cosine-similarity rank order"]
    RESULT --> RRF["RRF Fusion with L1 + L2"]
```

---

## Local Mirror Data Models

```mermaid
classDiagram
    class CatalogVocabularySchema {
        <<Zod schema — no _id>>
        +string[] categories
        +string[] types
        +string[] styles
        +string[] materials
        +string[] colors
        +Date refreshedAt
    }

    class CatalogVocabularyDocument {
        <<Mongoose document>>
        +string _id  singleton
    }

    class ProductEmbeddingSchema {
        <<Zod schema>>
        +string product_id
        +string category
        +string type
        +number price
        +number[] embedding  768-dim
        +string embedded_text
        +Date created_at
        +Date updated_at
    }

    class ProductEmbeddingDocument {
        <<Mongoose document>>
    }

    class VocabularyService {
        +getVocabulary(maxAgeMs?) Promise~CatalogVocabulary~
        +refresh(sampleSize?) Promise~CatalogVocabulary~
    }

    class EmbeddingsService {
        +isReady() Promise~boolean~
        +reconstructProse(analysis) string
        +search(analysis, candidateCount, priceRange?, category?) Promise~string[]~
    }

    CatalogVocabularySchema <|-- CatalogVocabularyDocument : Mongoose
    ProductEmbeddingSchema <|-- ProductEmbeddingDocument : Mongoose
    VocabularyService --> CatalogVocabularyDocument : InjectModel local
    EmbeddingsService --> ProductEmbeddingDocument : InjectModel local
```

---

## NestJS Module Dependency Graph

```mermaid
flowchart TD
    APP["AppModule"]

    APP --> CAT["CatalogModule\nAtlas read-only connection\ndefault connectionName"]
    APP --> MIRROR["MirrorModule\nLocal MongoDB connection\nconnectionName: 'local'"]
    APP --> VEX["VocabularyExpansionModule"]

    MIRROR --> VOC["VocabularyModule\nforFeature 'local'\nexports VocabularyService"]
    MIRROR --> EMB["EmbeddingsModule\nforFeature 'local'\nexports EmbeddingsService"]

    VEX --> VESVC["VocabularyExpansionService\n(stub — Phase 1)"]
```
