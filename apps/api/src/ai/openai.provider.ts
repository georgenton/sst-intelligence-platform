import { Injectable } from '@nestjs/common';
import { recommendationExplanationSchema, type SolutionRecommendation } from '@sst/contracts';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { AiProvider, ExplainInput } from './ai.types';

@Injectable()
export class OpenAiProvider implements AiProvider {
  async explain(input: ExplainInput) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) throw new Error('OPENAI_NOT_CONFIGURED');
    const client = new OpenAI({ apiKey });
    const response = await client.responses.parse({
      model,
      store: false,
      input: [
        {
          role: 'system',
          content:
            'Explica en español un resultado comercial SST ya calculado. No cambies scores, módulos ni fases; no afirmes cumplimiento legal, no diagnostiques personas y no emitas valoraciones clínicas.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            nonSensitiveAnswers: input.answers,
            deterministicRecommendation: input.recommendation,
          }),
        },
      ],
      text: { format: zodTextFormat(recommendationExplanationSchema, 'solution_explanation') },
    });
    const explanation = recommendationExplanationSchema.parse(response.output_parsed);
    this.assertSameModules(
      input.recommendation,
      explanation.moduleExplanations.map((item) => item.moduleKey),
    );
    return {
      provider: 'openai',
      model,
      explanation,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }

  private assertSameModules(recommendation: SolutionRecommendation, explained: string[]) {
    const expected = recommendation.recommendedModules.map((item) => item.moduleKey).sort();
    const actual = [...explained].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      throw new Error('OPENAI_MODULE_MISMATCH');
  }
}
