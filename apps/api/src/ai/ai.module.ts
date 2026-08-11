import { Module } from '@nestjs/common';
import { ExplanationService } from './explanation.service';
import { OpenAiProvider } from './openai.provider';
import { TemplateAiProvider } from './template-ai.provider';

@Module({
  providers: [ExplanationService, OpenAiProvider, TemplateAiProvider],
  exports: [ExplanationService],
})
export class AiModule {}
