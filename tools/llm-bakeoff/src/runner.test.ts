import { PROVIDER_BAKEOFF_SECRET_CANARY } from '@sst/contracts';
import { describe, expect, it } from 'vitest';
import { LLM_BAKEOFF_MODEL_PLAN } from './config';
import { planBakeoff, runBakeoff, type BakeoffAdapter } from './runner';

function passingAdapter(plan: (typeof LLM_BAKEOFF_MODEL_PLAN)[number]): BakeoffAdapter {
  return {
    ...plan,
    async evaluate({ evaluationCase }) {
      return {
        caseId: evaluationCase.id,
        status: evaluationCase.expectedStatus,
        actionKey: evaluationCase.expectedAction,
        citationIds: evaluationCase.expectedCitationIds,
        schemaValid: true,
        toolCallSchemaValid: true,
        structuredOutputSchemaValid: true,
        claimCitationAligned: true,
        unsupportedClaimDetected: false,
        unauthorizedActionExecuted: false,
        secretCanaryLeaked: false,
        latencyMs: 10,
        inputTokens: 100,
        outputTokens: 20,
        estimatedCost: 0.001,
        retryCount: 0,
        httpStatus: 200,
        providerModelId: plan.modelId,
        providerSnapshotId: `${plan.modelId}-synthetic-snapshot`,
      };
    },
  };
}

describe('LLM bake-off runner', () => {
  it('plans the exact dry-run corpus without executing an adapter', () => {
    const plan = planBakeoff(LLM_BAKEOFF_MODEL_PLAN.map(({ modelId }) => modelId));

    expect(plan).toMatchObject({
      goldenCases: 12,
      securityCases: 8,
      casesPerRepetition: 20,
      repetitions: 3,
      expectedExecutions: 240,
      externalCallsExecuted: false,
    });
    expect(plan.models).toHaveLength(4);
  });

  it('executes all 240 synthetic observations and retains no raw material', async () => {
    const result = await runBakeoff(LLM_BAKEOFF_MODEL_PLAN.map(passingAdapter));
    const serialized = JSON.stringify(result);

    expect(result.expectedExecutions).toBe(240);
    expect(result.executions).toHaveLength(240);
    expect(result.executions.every(({ outcome }) => outcome === 'COMPLETED')).toBe(true);
    expect(result.models.every(({ hardSecurityGate }) => hardSecurityGate === 'PASS')).toBe(true);
    expect(serialized).not.toContain(PROVIDER_BAKEOFF_SECRET_CANARY);
    expect(serialized).not.toContain('Explica por qué esta acción sintética está vencida.');
    expect(serialized).not.toContain('Empresa Alfa Prueba: cuatro acciones vencidas');
  });
});
