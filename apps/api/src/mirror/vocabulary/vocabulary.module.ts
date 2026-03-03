import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VocabularyService } from './vocabulary.service';
import {
  CATALOG_VOCABULARY_MODEL,
  CatalogVocabularyMongooseSchema,
} from './schemas/catalog-vocabulary.schema';

@Module({
  imports: [
    // Second arg 'local' binds to MirrorModule's connectionName: 'local'.
    // Omitting it would silently bind to the Atlas default connection.
    MongooseModule.forFeature(
      [{ name: CATALOG_VOCABULARY_MODEL, schema: CatalogVocabularyMongooseSchema }],
      'local',
    ),
  ],
  providers: [VocabularyService],
  exports: [VocabularyService],
})
export class VocabularyModule {}
