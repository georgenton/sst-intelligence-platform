import { calculateRecommendation, type SolutionAnswers } from '@sst/contracts';
import { ExplanationService } from './explanation.service';
import type { OpenAiProvider } from './openai.provider';
import type { TemplateAiProvider } from './template-ai.provider';
import type { PrismaService } from '../prisma/prisma.service';

const answers: SolutionAnswers = {
  country: 'Ecuador',
  sector: 'Manufactura',
  workerRange: '11_50',
  workCenters: 2,
  criticalActivities: true,
  workAtHeight: true,
  hotWork: false,
  electricity: false,
  chemicals: false,
  drivers: false,
  fireRisk: false,
  criticalAssets: false,
  contractors: false,
  managementSystem: 'SPREADSHEETS',
  inspectionFrequency: 'MONTHLY',
  manualPermits: true,
  evidenceDifficulty: false,
  overdueActions: true,
  recurringFindings: true,
  psychosocialEvaluation: false,
  multipleShifts: false,
  stressExposedRoles: false,
  organizationalCampaigns: false,
  objectives: ['TRACKING'],
  urgency: 'MEDIUM',
  estimatedUsers: 8,
  budgetRange: 'LOW',
  rolloutPreference: 'GRADUAL',
};

describe('ExplanationService', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    jest.restoreAllMocks();
  });

  it('falls back without mutating the deterministic recommendation', async () => {
    process.env.AI_ENABLED = 'true';
    process.env.AI_PROVIDER = 'openai';
    process.env.SST_DEPLOYMENT_ENVIRONMENT = 'staging';
    process.env.OPENAI_API_KEY = 'test-key-not-a-secret';
    process.env.OPENAI_MODEL = 'test-model';
    const recommendation = calculateRecommendation(answers);
    const immutableSnapshot = structuredClone(recommendation);
    const explanation = {
      headline: 'Explicación por plantilla',
      executiveSummary: 'Resumen seguro.',
      moduleExplanations: recommendation.recommendedModules.map((item) => ({
        moduleKey: item.moduleKey,
        why: item.reasons.join('. '),
        expectedValue: 'Valor esperado.',
      })),
      rolloutExplanation: 'Despliegue gradual.',
      disclaimer: 'No constituye cumplimiento legal.',
    };
    const template = {
      explain: jest.fn().mockResolvedValue({ provider: 'template', explanation }),
    } as unknown as TemplateAiProvider;
    const openai = {
      explain: jest.fn().mockRejectedValue(new Error('PROVIDER_UNAVAILABLE')),
    } as unknown as OpenAiProvider;
    const create = jest.fn().mockResolvedValue({ id: 'interaction-id' });
    const prisma = { aiInteraction: { create } } as unknown as PrismaService;
    const service = new ExplanationService(template, openai, prisma);

    const result = await service.explain({ answers, recommendation });

    expect(result).toEqual({ explanation, mode: 'template-fallback' });
    expect(recommendation).toEqual(immutableSnapshot);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FALLBACK' }) }),
    );
    expect(typeof create.mock.calls[0]?.[0]?.data?.inputHash).toBe('string');
  });
});
