# Catalog Module Architecture

## Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller as CatalogController
    participant Pipe as ZodValidationPipe
    participant Service as CatalogService
    participant Atlas as MongoDB Atlas

    Client->>Controller: GET /api/catalog/products?category=Wardrobes
    Controller->>Pipe: validate @Query() against productFilterSchema
    alt validation fails
        Pipe-->>Client: 400 Bad Request + Zod error details
    else valid
        Pipe->>Service: filter(ProductFilterDto)
        Service->>Atlas: find({ category: 'Wardrobes' })
        Note right of Atlas: uses index category_1_type_1_price_1
        Atlas-->>Service: ProductDocument[]
        Service-->>Controller: ProductDocument[]
        Controller-->>Client: 200 + JSON array
    end
```

## Zod → DTO → Mongoose Pipeline

```mermaid
flowchart LR
    ZOD["packages/common\nproductZodSchema\n(z.object)"]

    ZOD -->|"z.infer<>"| TYPE["Product\n(TypeScript type)"]
    ZOD -->|"createZodDto()"| DTO["CreateProductDto\nUpdateProductDto\nProductFilterDto\nProductSearchDto"]
    ZOD -->|"zodToMongooseSchema()"| MONGO["ProductMongooseSchema\n(mongoose.Schema)"]

    MONGO --> MODEL["Model<ProductDocument>"]
    MODEL --> SERVICE["CatalogService"]
    DTO --> CONTROLLER["CatalogController"]
    SERVICE --> CONTROLLER
```

## Data Model

```mermaid
classDiagram
    class productZodSchema {
        +string title
        +string description
        +string category
        +string type
        +number price USD
        +number width cm
        +number height cm
        +number depth cm
    }

    class ProductFilterDto {
        <<nestjs-zod DTO>>
        +string? category
        +string? type
        +number? minPrice
        +number? maxPrice
    }

    class ProductSearchDto {
        <<nestjs-zod DTO>>
        +string q
        +number limit default=20
    }

    class ProductMongooseSchema {
        <<mongoose.Schema>>
        derived via zodToMongooseSchema()
        autoIndex: false
        autoCreate: false
    }

    productZodSchema <|-- ProductFilterDto : createZodDto
    productZodSchema <|-- ProductSearchDto : createZodDto
    productZodSchema <|-- ProductMongooseSchema : zodToMongooseSchema
```

## Atlas Index Usage

| Endpoint | Index | Query |
|---|---|---|
| `GET /catalog/products` | `category_1_type_1_price_1` | `find({ category?, type?, price? })` |
| `GET /catalog/products/search` | `title_text_description_text` | `find({ $text: { $search: q } })` |
| `GET /catalog/products/:id` | `_id_` | `findById(id)` |
