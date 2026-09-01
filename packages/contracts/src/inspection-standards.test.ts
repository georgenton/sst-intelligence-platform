import { describe, expect, it } from 'vitest';
import {
  canUseCriterionOutcome,
  inspectionCriterionResultInputSchema,
  inspectionStandardPolicyInputSchema,
  nextInspectionStandardPolicyVersion,
} from './inspection-standards';

describe('inspection standards contracts', () => {
  it('creates monotonically increasing policy versions', () => {
    expect(nextInspectionStandardPolicyVersion(null)).toBe(1);
    expect(nextInspectionStandardPolicyVersion(4)).toBe(5);
  });

  it('rejects duplicate domain bindings', () => {
    const result = inspectionStandardPolicyInputSchema.safeParse({
      bindings: [
        { inspectionDomain: 'ELECTRICAL', standardVersionId: crypto.randomUUID() },
        { inspectionDomain: 'ELECTRICAL', standardVersionId: crypto.randomUUID() },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('requires an observation for a nonconforming criterion', () => {
    expect(
      inspectionCriterionResultInputSchema.safeParse({
        outcome: 'NO_CONFORME',
        evidenceReferences: [],
      }).success,
    ).toBe(false);
    expect(
      inspectionCriterionResultInputSchema.safeParse({
        outcome: 'NO_CONFORME',
        note: 'Se observó una condición sintética.',
        evidenceReferences: [],
      }).success,
    ).toBe(true);
  });

  it('only allows No aplica when the exact criterion permits it', () => {
    expect(canUseCriterionOutcome('NO_APLICA', false)).toBe(false);
    expect(canUseCriterionOutcome('NO_APLICA', true)).toBe(true);
    expect(canUseCriterionOutcome('CONFORME', false)).toBe(true);
  });
});
