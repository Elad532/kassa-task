import { Module } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { VocabularyExpansionService } from './vocabulary-expansion.service';

const MappingSchema = z.object({
  mappings: z.array(z.object({ original: z.string(), mapped: z.string() })),
});

@Module({
  providers: [
    VocabularyExpansionService,
    {
      // Gemini Flash with structured output — maps non-catalog terms to catalog vocabulary.
      // Injected as 'GEMINI_FLASH_LLM' so tests can swap without touching VocabularyExpansionService.
      provide: 'GEMINI_FLASH_LLM',
      useFactory: () => {
        const llm = new ChatGoogleGenerativeAI({
          model: 'gemini-2.0-flash',
          apiKey: process.env.GEMINI_API_KEY,
        });
        return llm.withStructuredOutput(MappingSchema);
      },
    },
  ],
  exports: [VocabularyExpansionService],
})
export class VocabularyExpansionModule {}
