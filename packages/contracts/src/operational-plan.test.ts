import type { SstCapabilityKey } from './sst-assessment.js';
import { describe, expect, it } from 'vitest';
import {
  buildDeterministicOperationalPlanDraft,
  buildAssessmentOperationalPlanDraft,
  buildIncorporatedAssessmentOperationalPlanDraft,
  type OperationalPlanVersionInput,
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

describe('incorporating selected diagnosis proposals into a persisted active plan', () => {
  const original: OperationalPlanVersionInput = {
    name: 'Plan vigente original',
    description: 'Descripción preservada',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    origin: 'MANUAL',
    provenance: { humanReference: 'original' },
    items: [
      {
        title: 'Actividad original urgente',
        description: 'Contenido original',
        startsAt: '2026-02-01',
        dueAt: '2026-03-01',
        frequency: 'Mensual',
        priority: 'URGENT',
        evidenceReferences: ['evidencia:original'],
        provenanceType: 'MANUAL',
        provenanceReference: 'original',
        provenanceSnapshot: { note: 'original' },
      },
    ],
  };
  const base = {
    sourcePlanId: '10000000-0000-4000-8000-000000000002',
    sourceVersionId: '10000000-0000-4000-8000-000000000003',
    sourceVersion: original,
    inheritedItems: [
      { id: '10000000-0000-4000-8000-000000000004', displayOrder: 5, item: original.items[0]! },
    ],
    selection: { selectedCapabilityKeys: ['INSPECTIONS', 'GOVERNANCE'] as SstCapabilityKey[] },
    assessmentSessionId: assessmentId,
    capabilityEvaluation: storedEvaluation,
  };
  it('preserves inherited content/provenance and appends only the selected proposals without invented assignments or dates', () => {
    const before = structuredClone(base);
    const draft = buildIncorporatedAssessmentOperationalPlanDraft(base);
    expect(draft.items).toHaveLength(3);
    expect(draft.items[0]).toEqual({
      ...original.items[0],
      provenanceSnapshot: {
        note: 'original',
        inheritedFromPlanId: base.sourcePlanId,
        inheritedFromVersionId: base.sourceVersionId,
        inheritedFromItemId: base.inheritedItems[0]!.id,
      },
    });
    expect(draft.description).toBe(original.description);
    for (const item of draft.items.slice(1)) {
      expect(item.provenanceType).toBe('UNIFIED_SST_EVALUATION');
      expect(item.dueAt).toBeUndefined();
      expect(item.responsibleUserId).toBeUndefined();
      expect(item.workCenterId).toBeUndefined();
      expect(item.provenanceSnapshot.capabilityKey).not.toBe('WORKFORCE');
    }
    expect(base).toEqual(before);
    expect(JSON.stringify(draft)).not.toMatch(/ruleKeys|score|entitlement|subscription/);
  });
  it('orders inherited items by source display order and proposals independently of input selection order', () => {
    const second = {
      id: '10000000-0000-4000-8000-000000000005',
      displayOrder: 1,
      item: { ...original.items[0]!, title: 'Primera actividad de origen' },
    };
    const a = buildIncorporatedAssessmentOperationalPlanDraft({
      ...base,
      inheritedItems: [...base.inheritedItems, second],
    });
    const b = buildIncorporatedAssessmentOperationalPlanDraft({
      ...base,
      inheritedItems: [second, ...base.inheritedItems],
      selection: { selectedCapabilityKeys: [...base.selection.selectedCapabilityKeys].reverse() },
    });
    expect(a.items[0]!.title).toBe(second.item.title);
    expect(a).toEqual(b);
    expect(operationalPlanContentDigest(a)).toBe(operationalPlanContentDigest(b));
  });
  it('inherits metadata when optional transport fields are present with undefined values', () => {
    const draft = buildIncorporatedAssessmentOperationalPlanDraft({
      ...base,
      selection: {
        ...base.selection,
        name: undefined,
        description: undefined,
        periodStart: undefined,
        periodEnd: undefined,
        responsibleUserId: undefined,
      },
    });
    expect(draft.name).toBe(original.name);
    expect(draft.description).toBe(original.description);
    expect(draft.periodStart).toBe(original.periodStart);
    expect(draft.periodEnd).toBe(original.periodEnd);
  });
  it.each([[], ['INSPECTIONS', 'INSPECTIONS'], ['WORK_PERMITS']])(
    'rejects empty, duplicate or unavailable selection %j',
    (selected) => {
      expect(() =>
        buildIncorporatedAssessmentOperationalPlanDraft({
          ...base,
          selection: { selectedCapabilityKeys: selected as SstCapabilityKey[] },
        }),
      ).toThrow();
    },
  );
});
