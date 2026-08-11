import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROMPT_VERSION, AI_USE_CASE, type ExplainInput } from './ai.types';
import { OpenAiProvider } from './openai.provider';
import { TemplateAiProvider } from './template-ai.provider';

type Actor = { organizationId?: string; userId?: string };

@Injectable()
export class ExplanationService {
  constructor(
    private readonly template: TemplateAiProvider,
    private readonly openai: OpenAiProvider,
    private readonly prisma: PrismaService,
  ) {}

  async explain(input: ExplainInput, actor: Actor = {}) {
    const startedAt = Date.now();
    const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const useOpenAi =
      process.env.AI_ENABLED === 'true' &&
      process.env.AI_PROVIDER === 'openai' &&
      Boolean(process.env.OPENAI_API_KEY) &&
      Boolean(process.env.OPENAI_MODEL);
    try {
      const result = await (useOpenAi ? this.openai : this.template).explain(input);
      await this.log({
        ...actor,
        useCase: AI_USE_CASE,
        provider: result.provider,
        model: result.model,
        promptVersion: AI_PROMPT_VERSION,
        latencyMs: Date.now() - startedAt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        status: 'SUCCEEDED',
        inputHash,
      });
      return { explanation: result.explanation, mode: result.provider };
    } catch (error: unknown) {
      const fallback = await this.template.explain(input);
      await this.log({
        ...actor,
        useCase: AI_USE_CASE,
        provider: 'openai',
        model: process.env.OPENAI_MODEL,
        promptVersion: AI_PROMPT_VERSION,
        latencyMs: Date.now() - startedAt,
        status: 'FALLBACK',
        errorCategory: error instanceof Error ? error.message.slice(0, 80) : 'UNKNOWN',
        inputHash,
      });
      return { explanation: fallback.explanation, mode: 'template-fallback' };
    }
  }

  private log(data: Parameters<PrismaService['aiInteraction']['create']>[0]['data']) {
    return this.prisma.aiInteraction.create({ data, select: { id: true } });
  }
}
