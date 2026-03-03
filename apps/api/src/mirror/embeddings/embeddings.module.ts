import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
