import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VocabularyService } from './vocabulary.service';
import {
  CATALOG_VOCABULARY_MODEL,
  CatalogVocabularyMongooseSchema,
} from './schemas/catalog-vocabulary.schema';
import { PRODUCT_MODEL } from '../../catalog/catalog.service';
import { ProductMongooseSchema } from '../../catalog/schemas/product.schema';

@Module({
  imports: [
    // Second arg 'local' binds to MirrorModule's connectionName: 'local'.
    // Omitting it would silently bind to the Atlas default connection.
    MongooseModule.forFeature(
      [{ name: CATALOG_VOCABULARY_MODEL, schema: CatalogVocabularyMongooseSchema }],
      'local',
    ),
    // Atlas Product model — default connection (no connectionName).
    // VocabularyService.refresh() uses this to query distinct category/type terms.
    // The default connection is established by CatalogModule in AppModule.
    MongooseModule.forFeature([{ name: PRODUCT_MODEL, schema: ProductMongooseSchema }]),
  ],
  providers: [VocabularyService],
  exports: [VocabularyService],
})
export class VocabularyModule {}
