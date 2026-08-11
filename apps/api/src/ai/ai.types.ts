import type {
  RecommendationExplanation,
  SolutionAnswers,
  SolutionRecommendation,
} from '@sst/contracts';

export type ExplainInput = {
  answers: SolutionAnswers;
  recommendation: SolutionRecommendation;
};

export type AiResult = {
  explanation: RecommendationExplanation;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  explain(input: ExplainInput): Promise<AiResult>;
}

export const AI_USE_CASE = 'ExplainSolutionRecommendation';
export const AI_PROMPT_VERSION = 'explain-solution-v1';
