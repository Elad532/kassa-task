import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';

@Module({
  imports: [
    // connectionName: 'local' creates a separate Mongoose connection for local MongoDB.
    // This is distinct from the Atlas default connection in CatalogModule.
    // All forFeature and @InjectModel calls in child modules MUST use 'local'
    // or NestJS silently binds them to the Atlas connection.
    MongooseModule.forRootAsync({
      connectionName: 'local',
      useFactory: () => ({
        uri: process.env.LOCAL_MONGODB_URI ?? 'mongodb://localhost:27017/kassa',
        // Local MongoDB is writable — allow index and collection creation
        autoIndex: true,
        autoCreate: true,
      }),
    }),
    VocabularyModule,
    EmbeddingsModule,
  ],
  exports: [VocabularyModule, EmbeddingsModule],
})
export class MirrorModule {}
