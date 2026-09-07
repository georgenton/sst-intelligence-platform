import { describe, expect, it } from 'vitest';
import { validateInspectionDraftProposal } from './inspection-resource-scope.js';

describe('Inspection Resource Scope V0 contracts', () => {
  const resourceId = '70000000-0000-4000-8000-000000000011';
  const unitId = '70000000-0000-4000-8000-000000000099';
  const sourceId = '70000000-0000-4000-8000-000000000097';
  const sourceVersionId = '70000000-0000-4000-8000-000000000098';
  const valid = {
    jurisdictionCode: 'EC',
    resourceId,
    requestedAction: 'CREATE_EDITORIAL_PROPOSAL',
    criteria: [
      {
        title: 'Revisar condición visible',
        guidance: 'Registrar la observación sin declarar cumplimiento.',
        sourceId,
        sourceVersionId,
        sourceUnitId: unitId,
        sourceLocator: 'Art. 18',
      },
    ],
  };

  it('accepts only exact allowlisted stored citations', () => {
    expect(
      validateInspectionDraftProposal({
        output: valid,
        expectedJurisdictionCode: 'EC',
        expectedResourceId: resourceId,
        allowedUnits: new Map([[unitId, { locator: 'Art. 18', sourceId, sourceVersionId }]]),
      }),
    ).toEqual(valid);
  });

  it.each([
    [
      'invented citation',
      { ...valid, criteria: [{ ...valid.criteria[0], sourceUnitId: crypto.randomUUID() }] },
    ],
    ['nonexistent resource', { ...valid, resourceId: crypto.randomUUID() }],
    ['foreign source represented as Ecuador', { ...valid, jurisdictionCode: 'CO' }],
    [
      'source outside the allowlist tuple',
      { ...valid, criteria: [{ ...valid.criteria[0], sourceId: crypto.randomUUID() }] },
    ],
    [
      'source version outside the allowlist tuple',
      { ...valid, criteria: [{ ...valid.criteria[0], sourceVersionId: crypto.randomUUID() }] },
    ],
    [
      'locator that does not match the stored unit',
      { ...valid, criteria: [{ ...valid.criteria[0], sourceLocator: 'Art. inventado' }] },
    ],
    ['invalid schema', { ...valid, criteria: [] }],
    ['unknown action', { ...valid, requestedAction: 'PUBLISH_RULE' }],
  ])('rejects %s', (_label, output) => {
    expect(() =>
      validateInspectionDraftProposal({
        output,
        expectedJurisdictionCode: 'EC',
        expectedResourceId: resourceId,
        allowedUnits: new Map([[unitId, { locator: 'Art. 18', sourceId, sourceVersionId }]]),
      }),
    ).toThrow();
  });
});
