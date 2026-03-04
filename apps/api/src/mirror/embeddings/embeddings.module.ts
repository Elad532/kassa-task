import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { EmbeddingsService } from './embeddings.service';
import {
  PRODUCT_EMBEDDING_MODEL,
  ProductEmbeddingMongooseSchema,
} from './schemas/product-embedding.schema';

@Module({
  imports: [
    // Second arg 'local' binds to MirrorModule's connectionName: 'local'.
    // Omitting it would silently bind to the Atlas default connection.
    MongooseModule.forFeature(
      [{ name: PRODUCT_EMBEDDING_MODEL, schema: ProductEmbeddingMongooseSchema }],
      'local',
    ),
  ],
  providers: [
    EmbeddingsService,
    {
      // Gemini text-embedding-004 (768-dim). ONLY this model may be used —
      // mixing models invalidates cosine similarity for the entire collection.
      // Injected as 'EMBEDDINGS_CLIENT' so tests can swap without touching EmbeddingsService.
      provide: 'EMBEDDINGS_CLIENT',
      useFactory: () =>
        new GoogleGenerativeAIEmbeddings({
          model: 'text-embedding-004',
          apiKey: process.env.GEMINI_API_KEY,
        }),
    },
  ],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
