import { describe, expect, it } from 'vitest';
import { inspectionBasisCompositionSchema } from './inspection-basis';

const primary = {
  standardVersionId: '10000000-0000-4000-8000-000000000001',
  role: 'PRIMARY_TECHNICAL' as const,
  displayOrder: 1,
};

describe('Inspection Basis composition', () => {
  it('accepts one primary with supplemental sources and multiple separate articles', () => {
    const result = inspectionBasisCompositionSchema.safeParse({
      technicalSources: [
        primary,
        {
          standardVersionId: '10000000-0000-4000-8000-000000000002',
          role: 'SUPPLEMENTAL_TECHNICAL',
          displayOrder: 2,
        },
      ],
      regulatoryUnits: [
        { regulatoryUnitId: '20000000-0000-4000-8000-000000000001', displayOrder: 1 },
        { regulatoryUnitId: '20000000-0000-4000-8000-000000000002', displayOrder: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { technicalSources: [], label: 'missing primary' },
    {
      technicalSources: [
        primary,
        {
          ...primary,
          standardVersionId: '10000000-0000-4000-8000-000000000002',
          displayOrder: 2,
        },
      ],
      label: 'two primary sources',
    },
  ])('rejects $label', ({ technicalSources }) => {
    expect(inspectionBasisCompositionSchema.safeParse({ technicalSources }).success).toBe(false);
  });

  it('rejects criterion provenance to a unit outside the selected legal context', () => {
    const result = inspectionBasisCompositionSchema.safeParse({
      technicalSources: [primary],
      regulatoryUnits: [],
      criterionRegulatoryLinks: [
        {
          criterionId: '30000000-0000-4000-8000-000000000001',
          regulatoryUnitId: '20000000-0000-4000-8000-000000000001',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
