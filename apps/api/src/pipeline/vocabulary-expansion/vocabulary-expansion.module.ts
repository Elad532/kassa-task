import { Module } from '@nestjs/common';
import { VocabularyExpansionService } from './vocabulary-expansion.service';

@Module({
  providers: [VocabularyExpansionService],
  exports: [VocabularyExpansionService],
})
export class VocabularyExpansionModule {}
