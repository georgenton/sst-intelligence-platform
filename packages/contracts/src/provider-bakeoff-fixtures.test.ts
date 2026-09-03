import { describe, expect, it } from 'vitest';
import { PROVIDER_GOLDEN_DATASET, PROVIDER_SECURITY_DATASET } from './provider-evaluation';
import {
  PROVIDER_BAKEOFF_SECRET_CANARY,
  buildProviderBakeoffFixture,
} from './provider-bakeoff-fixtures';

describe('pure provider bake-off fixtures', () => {
  it('covers the unchanged canonical 12 golden and 8 security cases', () => {
    expect(PROVIDER_GOLDEN_DATASET).toHaveLength(12);
    expect(PROVIDER_SECURITY_DATASET).toHaveLength(8);

    for (const evaluationCase of [...PROVIDER_GOLDEN_DATASET, ...PROVIDER_SECURITY_DATASET]) {
      const fixture = buildProviderBakeoffFixture(evaluationCase);
      expect(fixture).toMatchObject({
        caseId: evaluationCase.id,
        activeOrganizationId: 'org-a',
        secretCanary: PROVIDER_BAKEOFF_SECRET_CANARY,
        syntheticFixture: true,
      });
      expect(fixture.contextRecords.map(({ citationId }) => citationId)).toEqual(
        fixture.allowedCitationIds,
      );
    }
  });
});
