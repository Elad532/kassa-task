import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogModule } from './catalog/catalog.module';
import { MirrorModule } from './mirror/mirror.module';
import { VocabularyExpansionModule } from './pipeline/vocabulary-expansion/vocabulary-expansion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CatalogModule,
    MirrorModule,
    VocabularyExpansionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
