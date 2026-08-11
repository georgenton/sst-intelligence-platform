import { describe, expect, it } from 'vitest';
import { buildRollout, calculateRecommendation, suggestPlan } from './recommendation.js';
import type { SolutionAnswers } from './schemas.js';

const answers: SolutionAnswers = {
  country: 'Ecuador',
  sector: 'Manufactura',
  workerRange: '51_200',
  workCenters: 3,
  criticalActivities: true,
  workAtHeight: true,
  hotWork: true,
  electricity: false,
  chemicals: false,
  drivers: false,
  fireRisk: true,
  criticalAssets: true,
  contractors: true,
  managementSystem: 'SPREADSHEETS',
  inspectionFrequency: 'MONTHLY',
  manualPermits: true,
  evidenceDifficulty: true,
  overdueActions: true,
  recurringFindings: true,
  psychosocialEvaluation: false,
  multipleShifts: false,
  stressExposedRoles: false,
  organizationalCampaigns: false,
  objectives: ['COMPLIANCE', 'TRACKING'],
  urgency: 'HIGH',
  estimatedUsers: 18,
  budgetRange: 'LOW',
  rolloutPreference: 'GRADUAL',
};

describe('recommendation engine', () => {
  it('recommends inspection, permits, technical risk and compliance deterministically', () => {
    const first = calculateRecommendation(answers);
    expect(calculateRecommendation(answers)).toEqual(first);
    expect(first.recommendedModules.map((item) => item.moduleKey)).toEqual(
      expect.arrayContaining([
        'CORE',
        'INSPECTIONS_INTELLIGENCE',
        'WORK_PERMITS',
        'TECHNICAL_RISK',
        'COMPLIANCE',
      ]),
    );
  });

  it('does not remove detected needs when the budget is low', () => {
    const low = calculateRecommendation(answers);
    const high = calculateRecommendation({
      ...answers,
      budgetRange: 'HIGH',
      rolloutPreference: 'INTEGRAL',
    });
    expect(low.recommendedModules).toEqual(high.recommendedModules);
    expect(low.suggestedRollout.length).toBeGreaterThan(high.suggestedRollout.length);
  });

  it('suggests larger plans from operational scale', () => {
    expect(suggestPlan({ ...answers, estimatedUsers: 150 }, 2)).toBe('ENTERPRISE');
    expect(suggestPlan({ ...answers, estimatedUsers: 30 }, 2)).toBe('GROWTH');
    expect(suggestPlan(answers, 2)).toBe('STARTER');
  });

  it('creates a second rollout phase for constrained budgets', () => {
    const result = calculateRecommendation(answers);
    expect(buildRollout(result.recommendedModules, answers)).toHaveLength(2);
  });
});
