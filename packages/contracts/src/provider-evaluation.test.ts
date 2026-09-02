import { describe, expect, it } from 'vitest';
import {
  PROVIDER_GOLDEN_DATASET,
  PROVIDER_SECURITY_DATASET,
  evaluateProviderObservations,
  providerEvaluationObservationSchema,
} from './provider-evaluation';

describe('provider-neutral evaluation harness', () => {
  it('contains the required synthetic functional and security coverage', () => {
    expect(PROVIDER_GOLDEN_DATASET.map(({ category }) => category)).toEqual(
      expect.arrayContaining([
        'WORK_QUEUE',
        'INSPECTION_BASIS',
        'JURISDICTION',
        'RISK_METHOD',
        'INCIDENT',
        'EVIDENCE_PACKAGE',
        'GOVERNANCE',
        'OPERATIONAL_SIGNAL',
        'PORTFOLIO',
        'SECURITY',
      ]),
    );
    expect(PROVIDER_SECURITY_DATASET.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'prompt-injection',
        'cross-tenant-id',
        'invented-citation',
        'unsupported-tool',
        'final-legal-conclusion',
        'final-risk-decision',
        'root-cause-decision',
        'multi-org-mutation',
      ]),
    );
    expect(
      [...PROVIDER_GOLDEN_DATASET, ...PROVIDER_SECURITY_DATASET].every(
        ({ syntheticFixture }) => syntheticFixture,
      ),
    ).toBe(true);
  });

  it('reports transparent metrics without producing an opaque score', () => {
    const cases = PROVIDER_GOLDEN_DATASET.slice(0, 2);
    const observations = cases.map((evaluationCase, index) => ({
      caseId: evaluationCase.id,
      status: evaluationCase.expectedStatus,
      actionKey: evaluationCase.expectedAction,
      citationIds: evaluationCase.expectedCitationIds,
      schemaValid: true,
      unsupportedClaimDetected: false,
      unauthorizedActionExecuted: false,
      secretCanaryLeaked: false,
      latencyMs: 20 + index * 10,
      inputTokens: 10,
      outputTokens: 5,
      estimatedCost: 0,
    }));
    const metrics = evaluateProviderObservations(cases, observations);
    expect(metrics).toMatchObject({
      cases: 2,
      citationPrecision: { matched: 2, returned: 2 },
      citationCompleteness: { matched: 2, expected: 2 },
      structuredSchemaValidity: { valid: 2, total: 2 },
      latencyMs: { min: 20, max: 30, average: 25 },
      tokenTelemetry: { input: 20, output: 10, observations: 2 },
      secretLeakageCount: 0,
    });
    expect(metrics).not.toHaveProperty('score');
  });

  it('requires structured, measurable and secret-canary-aware adapter observations', () => {
    expect(
      providerEvaluationObservationSchema.parse({
        caseId: 'synthetic-case',
        status: 'NOT_AUTHORIZED',
        citationIds: [],
        schemaValid: true,
        unsupportedClaimDetected: false,
        unauthorizedActionExecuted: false,
        secretCanaryLeaked: false,
        latencyMs: 42,
      }),
    ).toMatchObject({ caseId: 'synthetic-case', latencyMs: 42 });
    expect(() =>
      providerEvaluationObservationSchema.parse({
        caseId: 'invalid',
        status: 'ANSWERED',
        citationIds: [],
        latencyMs: -1,
      }),
    ).toThrow();
  });
});
