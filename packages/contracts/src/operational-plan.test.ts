import type { SstCapabilityKey } from './sst-assessment.js';
import { describe, expect, it } from 'vitest';
import {
  buildDeterministicOperationalPlanDraft,
  buildAssessmentOperationalPlanDraft,
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

const assessmentId = '10000000-0000-4000-8000-000000000001';
const storedEvaluation = {
  engineVersion: '1.2.0',
  outputHash: `sha256:${'b'.repeat(64)}`,
  recommendations: [
    {
      capabilityKey: 'WORKFORCE',
      title: 'Personas y puestos',
      description: 'Organizar personas y puestos.',
      reasons: ['Personas confirmadas.'],
      priority: 'LOW',
    },
    {
      capabilityKey: 'INSPECTIONS',
      title: 'Inspecciones inteligentes',
      description: 'Revisar y organizar inspecciones y seguimiento.',
      reasons: ['Práctica informal confirmada.'],
      priority: 'HIGH',
    },
    {
      capabilityKey: 'GOVERNANCE',
      title: 'Gobernanza SST',
      description: 'Revisar y organizar el seguimiento.',
      reasons: ['Dificultad documental declarada.'],
      priority: 'MEDIUM',
    },
  ],
};
const handoff = () => ({
  assessmentSessionId: assessmentId,
  capabilityEvaluation: storedEvaluation,
  name: 'Plan del diagnóstico',
  periodStart: '2026-09-01',
  periodEnd: '2026-12-31',
  selectedCapabilityKeys: ['INSPECTIONS', 'GOVERNANCE'] as const,
});

describe('assessment Operational Plan handoff', () => {
  it('includes only the human subset and records excluded capabilities without changing the source', () => {
    const before = structuredClone(storedEvaluation);
    const draft = buildAssessmentOperationalPlanDraft({
      ...handoff(),
      selectedCapabilityKeys: [...handoff().selectedCapabilityKeys],
    });
    expect(draft.items.map((i) => i.provenanceSnapshot.capabilityKey)).toEqual([
      'INSPECTIONS',
      'GOVERNANCE',
    ]);
    expect(draft.provenance).toMatchObject({
      createdFrom: 'SST_ASSESSMENT',
      assessmentSessionId: assessmentId,
      selectedCapabilityKeys: ['GOVERNANCE', 'INSPECTIONS'],
      excludedCapabilityKeys: ['WORKFORCE'],
    });
    expect(storedEvaluation).toEqual(before);
    expect(draft.origin).toBe('DETERMINISTIC_DRAFT');
  });
  it('is deterministic across selection and recommendation order, including content digest', () => {
    const a = buildAssessmentOperationalPlanDraft({
      ...handoff(),
      selectedCapabilityKeys: [...handoff().selectedCapabilityKeys],
    });
    const b = buildAssessmentOperationalPlanDraft({
      ...handoff(),
      selectedCapabilityKeys: [...handoff().selectedCapabilityKeys].reverse(),
      capabilityEvaluation: {
        ...storedEvaluation,
        recommendations: [...storedEvaluation.recommendations].reverse(),
      },
    });
    expect(b).toEqual(a);
    expect(operationalPlanContentDigest(b)).toBe(operationalPlanContentDigest(a));
  });
  it.each(
    [[], ['PPE'], ['INSPECTIONS', 'INSPECTIONS'], ['NOT_A_CAPABILITY']].map((keys) => [keys]),
  )('rejects invalid human selection %j', (selectedCapabilityKeys) => {
    expect(() =>
      buildAssessmentOperationalPlanDraft({
        ...handoff(),
        selectedCapabilityKeys: selectedCapabilityKeys as SstCapabilityKey[],
      }),
    ).toThrow();
  });
  it('preserves priorities and compact immutable source identity without inventing operational or regulatory facts', () => {
    const draft = buildAssessmentOperationalPlanDraft({
      ...handoff(),
      selectedCapabilityKeys: ['WORKFORCE', 'INSPECTIONS', 'GOVERNANCE'],
    });
    expect(draft.items.map((i) => i.priority)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    for (const item of draft.items) {
      expect(item.provenanceType).toBe('UNIFIED_SST_EVALUATION');
      expect(item.provenanceSnapshot).toMatchObject({
        assessmentSessionId: assessmentId,
        engineVersion: '1.2.0',
        outputHash: storedEvaluation.outputHash,
      });
      expect(item.provenanceReference!.length).toBeLessThanOrEqual(240);
      expect(item.dueAt).toBeUndefined();
      expect(item.startsAt).toBeUndefined();
      expect(item.frequency).toBeUndefined();
      expect(item.responsibleUserId).toBeUndefined();
      expect(item.workCenterId).toBeUndefined();
      expect(item.evidenceReferences).toEqual([]);
      expect(item.provenanceSnapshot).not.toHaveProperty('score');
      expect(item.provenanceSnapshot).not.toHaveProperty('ruleKeys');
    }
    expect(JSON.stringify(draft)).not.toMatch(
      /ObligationExecution|RuleVersion|Requirement|subscription|entitlement|moduleId/,
    );
  });
  it('keeps historical source versions and absent output hashes readable', () => {
    const draft = buildAssessmentOperationalPlanDraft({
      ...handoff(),
      selectedCapabilityKeys: ['INSPECTIONS'],
      capabilityEvaluation: { ...storedEvaluation, engineVersion: '1.1.0', outputHash: undefined },
    });
    expect(draft.provenance.capabilityEngineVersion).toBe('1.1.0');
    expect(draft.provenance).not.toHaveProperty('capabilityEvaluationOutputHash');
  });
});
