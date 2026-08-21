import { describe, expect, it } from 'vitest';
import { ADAPTIVE_SCENARIOS, validateAdaptiveScenarios } from './validation.js';

describe('adaptive SST independent expectations', () => {
  it('passes all committed synthetic scenarios', () => {
    expect(validateAdaptiveScenarios()).toMatchObject({ scenarioCount: 3, overallPass: true });
  });

  it('fails when a literal expectation is wrong', () => {
    const mismatched = structuredClone(ADAPTIVE_SCENARIOS);
    mismatched[0]!.expectedItems = [
      { scopeKey: 'organization', targetKey: 'IMPOSSIBLE_TARGET', minimumDepth: 'SYSTEMIC' },
    ];
    expect(validateAdaptiveScenarios(mismatched).overallPass).toBe(false);
  });
});
