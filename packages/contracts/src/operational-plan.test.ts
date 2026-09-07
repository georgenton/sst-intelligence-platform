import { describe, expect, it } from 'vitest';
import {
  buildDeterministicOperationalPlanDraft,
  canTransitionOperationalPlanItem,
  operationalPlanContentDigest,
} from './operational-plan.js';

describe('Operational Plan V0 contracts', () => {
  it('keeps immutable plan content deterministic and distinct from execution state', () => {
    const base = {
      name: 'Plan preventivo 2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      provenance: { assessmentId: 'evaluation-1' },
      signals: [
        {
          sourceType: 'FINDING' as const,
          sourceId: 'finding-b',
          title: 'Corregir tomacorriente',
          priority: 'HIGH' as const,
        },
        {
          sourceType: 'OBLIGATION_EXECUTION' as const,
          sourceId: 'obligation-a',
          title: 'Revisar registro interno',
          priority: 'MEDIUM' as const,
        },
      ],
    };
    const forward = buildDeterministicOperationalPlanDraft(base);
    const reverse = buildDeterministicOperationalPlanDraft({
      ...base,
      signals: [...base.signals].reverse(),
    });
    expect(forward).toEqual(reverse);
    expect(forward.items.map(({ provenanceReference }) => provenanceReference)).toEqual([
      'finding-b',
      'obligation-a',
    ]);
    expect(operationalPlanContentDigest(forward)).toBe(operationalPlanContentDigest(reverse));
    expect(canTransitionOperationalPlanItem('PLANNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionOperationalPlanItem('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });
});
