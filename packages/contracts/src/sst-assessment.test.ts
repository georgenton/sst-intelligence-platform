import { describe, expect, it } from 'vitest';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_FACT_CATALOG,
  SST_ASSESSMENT_SCHEMA_VERSION,
  calculateSstAssessmentProgress,
  normalizeSstAssessmentSnapshot,
  parseSstAssessmentSnapshot,
  planSstAssessmentQuestions,
  resolveSstAssessmentReadiness,
  sstAssessmentFactSchema,
  sstAssessmentSemanticHash,
  validateSstAssessmentFact,
  type SstAssessmentSnapshot,
} from './sst-assessment.js';

const scopes = [
  {
    scopeKey: 'organization',
    kind: 'ORGANIZATION' as const,
    order: 0,
    displayName: 'Organización',
  },
  { scopeKey: 'center:1', kind: 'WORK_CENTER' as const, order: 1, displayName: 'Centro uno' },
  { scopeKey: 'center:2', kind: 'WORK_CENTER' as const, order: 2, displayName: 'Centro dos' },
];

function snapshot(facts: SstAssessmentSnapshot['facts'] = []): SstAssessmentSnapshot {
  return {
    schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
    catalogVersion: SST_ASSESSMENT_CATALOG_VERSION,
    scopes,
    facts,
  };
}

const provenance = { source: 'PUBLIC_DECLARATION' as const };

describe('canonical SST assessment contract', () => {
  it('keeps unanswered, known false and explicitly unknown as three different states', () => {
    const falseFact = sstAssessmentFactSchema.parse({
      factKey: 'workCenter.hasChemicalProcesses',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: false,
      provenance,
    });
    const unknownFact = sstAssessmentFactSchema.parse({
      factKey: 'workCenter.hasChemicalProcesses',
      scopeKey: 'center:2',
      answerState: 'EXPLICIT_UNKNOWN',
      provenance,
    });
    const result = snapshot([falseFact, unknownFact]);
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toMatchObject({ answerState: 'KNOWN', value: false });
    expect(result.facts[1]).toEqual(expect.objectContaining({ answerState: 'EXPLICIT_UNKNOWN' }));
    expect(
      result.facts.some(({ factKey }) => factKey === 'workCenter.hasHighEnergyOperations'),
    ).toBe(false);
  });

  it('does not ask an explicitly unknown fact again in the same session', () => {
    const facts = [
      sstAssessmentFactSchema.parse({
        factKey: 'workCenter.hasChemicalProcesses',
        scopeKey: 'center:1',
        answerState: 'EXPLICIT_UNKNOWN',
        provenance,
      }),
    ];
    expect(
      planSstAssessmentQuestions(snapshot(facts)).some(
        ({ scopeKey, factKey }) =>
          scopeKey === 'center:1' && factKey === 'workCenter.hasChemicalProcesses',
      ),
    ).toBe(false);
  });

  it('enforces canonical numeric and text catalog bounds', () => {
    const known = (factKey: string, scopeKey: string, value: number | string) =>
      sstAssessmentFactSchema.parse({
        factKey,
        scopeKey,
        answerState: 'KNOWN',
        value,
        provenance,
      });
    expect(() =>
      validateSstAssessmentFact(known('organization.totalWorkerCount', 'organization', 0), scopes),
    ).toThrow('bounded integer');
    expect(
      validateSstAssessmentFact(known('organization.totalWorkerCount', 'organization', 48), scopes),
    ).toMatchObject({ value: 48 });
    expect(() =>
      validateSstAssessmentFact(
        known('organization.totalWorkerCount', 'organization', 10_000_001),
        scopes,
      ),
    ).toThrow('bounded integer');
    expect(() =>
      validateSstAssessmentFact(known('organization.estimatedUsers', 'organization', 0), scopes),
    ).toThrow('bounded integer');
    expect(() =>
      validateSstAssessmentFact(
        known('organization.estimatedUsers', 'organization', 1_000_001),
        scopes,
      ),
    ).toThrow('bounded integer');
    expect(
      validateSstAssessmentFact(
        known('organization.additionalContext', 'organization', 'a'.repeat(2_000)),
        scopes,
      ),
    ).toMatchObject({
      value: 'a'.repeat(2_000),
    });
    expect(() =>
      validateSstAssessmentFact(
        known('organization.additionalContext', 'organization', 'a'.repeat(2_001)),
        scopes,
      ),
    ).toThrow('Expected text');
    expect(
      validateSstAssessmentFact(
        known('workCenter.activityDescription', 'center:1', 'a'.repeat(2_000)),
        scopes,
      ),
    ).toMatchObject({
      value: 'a'.repeat(2_000),
    });
    expect(() =>
      validateSstAssessmentFact(
        known('workCenter.activityDescription', 'center:1', 'a'.repeat(2_001)),
        scopes,
      ),
    ).toThrow('Expected text');
  });

  it('rejects empty known multi-choice values without conflating them with explicit unknown', () => {
    const multiChoice = (factKey: string, value: string[]) =>
      sstAssessmentFactSchema.parse({
        factKey,
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value,
        provenance,
      });
    expect(() =>
      validateSstAssessmentFact(multiChoice('workCenter.activityCategories', []), scopes),
    ).toThrow('Invalid choices');
    expect(() =>
      validateSstAssessmentFact(multiChoice('workCenter.facilityTypes', []), scopes),
    ).toThrow('Invalid choices');
    expect(() =>
      resolveSstAssessmentReadiness(snapshot([multiChoice('workCenter.activityCategories', [])])),
    ).toThrow('Invalid choices');
    expect(
      validateSstAssessmentFact(
        multiChoice('workCenter.activityCategories', ['WAREHOUSE', 'PRODUCTION']),
        scopes,
      ),
    ).toMatchObject({ value: ['PRODUCTION', 'WAREHOUSE'] });
    expect(
      validateSstAssessmentFact(
        sstAssessmentFactSchema.parse({
          factKey: 'workCenter.activityCategories',
          scopeKey: 'center:1',
          answerState: 'EXPLICIT_UNKNOWN',
          provenance,
        }),
        scopes,
      ),
    ).toMatchObject({ answerState: 'EXPLICIT_UNKNOWN' });
  });

  it('resolves readiness only after foundation questions are answered', () => {
    const foundationFacts = [
      ['organization.country', 'organization', 'Ecuador'],
      ['organization.totalWorkerCount', 'organization', 48],
      ['organization.workCenterCount', 'organization', 2],
      ['workCenter.workArrangement', 'center:1', 'PHYSICAL'],
      ['workCenter.activityCategories', 'center:1', ['PRODUCTION']],
      ['workCenter.facilityTypes', 'center:1', ['PLANT']],
      ['workCenter.workArrangement', 'center:2', 'REMOTE'],
      ['workCenter.activityCategories', 'center:2', ['ADMINISTRATIVE_SERVICES']],
      ['workCenter.facilityTypes', 'center:2', ['OFFICE']],
    ].map(([factKey, scopeKey, value]) =>
      sstAssessmentFactSchema.parse({ factKey, scopeKey, answerState: 'KNOWN', value, provenance }),
    );
    expect(resolveSstAssessmentReadiness(snapshot())).toBe('COLLECTING_INFORMATION');
    expect(resolveSstAssessmentReadiness(snapshot(foundationFacts))).toBe('DIAGNOSIS_READY');
    const withUnknown = foundationFacts.map((fact) =>
      fact.factKey === 'workCenter.facilityTypes' && fact.scopeKey === 'center:2'
        ? sstAssessmentFactSchema.parse({
            factKey: fact.factKey,
            scopeKey: fact.scopeKey,
            answerState: 'EXPLICIT_UNKNOWN',
            provenance,
          })
        : fact,
    );
    expect(resolveSstAssessmentReadiness(snapshot(withUnknown))).toBe('DIAGNOSIS_READY');
  });

  it('classifies blocking, context and commercial questions without derived authenticated dead ends', () => {
    const initial = planSstAssessmentQuestions(snapshot(), { channel: 'AUTHENTICATED' });
    expect(initial.some(({ factKey }) => factKey === 'organization.sector')).toBe(false);
    expect(initial).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'organization.managementSystem',
          collectionPolicy: 'CONTEXT_RECOMMENDED',
          blocking: false,
        }),
        expect.objectContaining({
          factKey: 'organization.budgetRange',
          collectionPolicy: 'COMMERCIAL_OPTIONAL',
          blocking: false,
        }),
      ]),
    );
    expect(initial.some(({ factKey }) => factKey === 'workCenter.hasChemicalProcesses')).toBe(
      false,
    );
    const promoted = planSstAssessmentQuestions(snapshot(), {
      channel: 'AUTHENTICATED',
      specialistQuestions: [
        {
          scopeKey: 'center:1',
          factKey: 'workCenter.hasChemicalProcesses',
          whyAsked: 'Requerido por el especialista.',
          relatedRuleKeys: ['CHEMICAL_PROCESS_RULE'],
          relatedTargetKeys: ['CHEMICAL_PROCESS_CONTROLS'],
        },
        {
          scopeKey: 'center:1',
          factKey: 'workCenter.hasChemicalProcesses',
          whyAsked: 'Duplicado.',
        },
      ],
    });
    expect(
      promoted.filter(({ factKey }) => factKey === 'workCenter.hasChemicalProcesses'),
    ).toHaveLength(1);
    expect(promoted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          blocking: true,
          relatedRuleKeys: ['CHEMICAL_PROCESS_RULE'],
          relatedTargetKeys: ['CHEMICAL_PROCESS_CONTROLS'],
        }),
      ]),
    );
  });

  it('does not block a remote center on a physical facility type question', () => {
    const remoteFacts = [
      ['organization.country', 'organization', 'Ecuador'],
      ['organization.totalWorkerCount', 'organization', 12],
      ['organization.workCenterCount', 'organization', 2],
      ['workCenter.workArrangement', 'center:1', 'REMOTE'],
      ['workCenter.activityCategories', 'center:1', ['ADMINISTRATIVE_SERVICES']],
      ['workCenter.workArrangement', 'center:2', 'PHYSICAL'],
      ['workCenter.activityCategories', 'center:2', ['PRODUCTION']],
      ['workCenter.facilityTypes', 'center:2', ['PLANT']],
    ].map(([factKey, scopeKey, value]) =>
      sstAssessmentFactSchema.parse({ factKey, scopeKey, answerState: 'KNOWN', value, provenance }),
    );
    const questions = planSstAssessmentQuestions(snapshot(remoteFacts));
    expect(questions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeKey: 'center:1',
          factKey: 'workCenter.facilityTypes',
        }),
      ]),
    );
    expect(resolveSstAssessmentReadiness(snapshot(remoteFacts))).toBe('DIAGNOSIS_READY');
  });

  it('keeps unanswered context and commercial questions discoverable without blocking readiness', () => {
    const blockingAnswers = planSstAssessmentQuestions(snapshot())
      .filter(({ blocking }) => blocking)
      .filter(({ factKey }) => factKey !== 'workCenter.facilityTypes')
      .map((question) =>
        sstAssessmentFactSchema.parse({
          factKey: question.factKey,
          scopeKey: question.scopeKey,
          answerState: 'EXPLICIT_UNKNOWN',
          provenance,
        }),
      );
    const questions = planSstAssessmentQuestions(snapshot(blockingAnswers));
    expect(
      questions.some(({ collectionPolicy }) => collectionPolicy === 'CONTEXT_RECOMMENDED'),
    ).toBe(true);
    expect(
      questions.some(({ collectionPolicy }) => collectionPolicy === 'COMMERCIAL_OPTIONAL'),
    ).toBe(true);
    expect(questions.every(({ blocking }) => !blocking)).toBe(true);
    expect(resolveSstAssessmentReadiness(snapshot(blockingAnswers))).toBe('DIAGNOSIS_READY');
  });

  it('makes conditional context relevant without turning it into a readiness blocker', () => {
    const blockingAnswers = planSstAssessmentQuestions(snapshot())
      .filter(({ blocking }) => blocking)
      .map((question) =>
        sstAssessmentFactSchema.parse({
          factKey: question.factKey,
          scopeKey: question.scopeKey,
          answerState: 'EXPLICIT_UNKNOWN',
          provenance,
        }),
      );
    const ready = snapshot(blockingAnswers);
    expect(resolveSstAssessmentReadiness(ready)).toBe('DIAGNOSIS_READY');
    const inspectionPractice = sstAssessmentFactSchema.parse({
      factKey: 'organization.inspectionPractice',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 'CHECKLISTS',
      provenance,
    });
    const branched = snapshot([...blockingAnswers, inspectionPractice]);
    expect(planSstAssessmentQuestions(branched)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'organization.inspectionFrequency',
          relevancePolicy: 'AFTER_INSPECTION_PRACTICE',
          blocking: false,
        }),
      ]),
    );
    expect(resolveSstAssessmentReadiness(branched)).toBe('DIAGNOSIS_READY');
  });

  it('resolves stored V1 and fails closed for unsupported pinned versions', () => {
    expect(parseSstAssessmentSnapshot(snapshot()).catalogVersion).toBe('1.0.0');
    expect(() => parseSstAssessmentSnapshot({ ...snapshot(), catalogVersion: '99.0.0' })).toThrow(
      'SST_ASSESSMENT_VERSION_UNSUPPORTED:CATALOG:99.0.0',
    );
    expect(() => parseSstAssessmentSnapshot({ ...snapshot(), schemaVersion: '99.0.0' })).toThrow(
      'SST_ASSESSMENT_VERSION_UNSUPPORTED:SCHEMA:99.0.0',
    );
  });

  it('keeps work-center facts isolated and never fans organization values out', () => {
    const facts = [
      sstAssessmentFactSchema.parse({
        factKey: 'workCenter.hasChemicalProcesses',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: true,
        provenance,
      }),
      sstAssessmentFactSchema.parse({
        factKey: 'workCenter.hasChemicalProcesses',
        scopeKey: 'center:2',
        answerState: 'KNOWN',
        value: false,
        provenance,
      }),
    ];
    const normalized = normalizeSstAssessmentSnapshot(snapshot(facts));
    expect(normalized.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'center:1', value: true }),
        expect.objectContaining({ scopeKey: 'center:2', value: false }),
      ]),
    );
  });

  it('retains multiple activity categories and facility types without compression', () => {
    const activities = validateSstAssessmentFact(
      sstAssessmentFactSchema.parse({
        factKey: 'workCenter.activityCategories',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: ['PRODUCTION', 'ADMINISTRATIVE_SERVICES', 'PRODUCTION'],
        provenance,
      }),
      scopes,
    );
    const facilities = validateSstAssessmentFact(
      sstAssessmentFactSchema.parse({
        factKey: 'workCenter.facilityTypes',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: ['PLANT', 'OFFICE'],
        provenance,
      }),
      scopes,
    );
    expect(activities).toMatchObject({ value: ['ADMINISTRATIVE_SERVICES', 'PRODUCTION'] });
    expect(facilities).toMatchObject({ value: ['OFFICE', 'PLANT'] });
  });

  it('produces the same semantic hash across channel metadata, row order and persistence ids', () => {
    const fact = sstAssessmentFactSchema.parse({
      factKey: 'organization.country',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 'EC',
      provenance,
    });
    const publicSnapshot = snapshot([fact]);
    const authenticatedSnapshot: SstAssessmentSnapshot = {
      ...publicSnapshot,
      scopes: [...publicSnapshot.scopes].reverse().map((scope, index) =>
        scope.kind === 'WORK_CENTER'
          ? {
              ...scope,
              displayName: `Nombre registrado ${index}`,
              workCenterId: `${index + 1}0000000-0000-4000-8000-000000000000`.slice(0, 36),
            }
          : { ...scope, displayName: 'Empresa registrada' },
      ),
      facts: [{ ...fact, provenance: { source: 'ORGANIZATION_RECORD' } }],
    };
    expect(sstAssessmentSemanticHash(authenticatedSnapshot)).toBe(
      sstAssessmentSemanticHash(publicSnapshot),
    );
  });

  it('deduplicates questions by scope and fact and orders them deterministically', () => {
    const forward = planSstAssessmentQuestions(snapshot());
    const reversed = planSstAssessmentQuestions({ ...snapshot(), scopes: [...scopes].reverse() });
    expect(new Set(forward.map(({ questionId }) => questionId)).size).toBe(forward.length);
    expect(reversed).toEqual(forward);
  });

  it('reports progress by topic instead of a compliance percentage', () => {
    const progress = calculateSstAssessmentProgress(snapshot());
    expect(progress.totalTopics).toBeGreaterThan(1);
    expect(progress).not.toHaveProperty('percentage');
    expect(progress.topics.every(({ total }) => total > 0)).toBe(true);
  });

  it('publishes human labels and collection metadata from one catalog', () => {
    const activities = SST_ASSESSMENT_FACT_CATALOG.find(
      ({ factKey }) => factKey === 'workCenter.activityCategories',
    );
    expect(activities).toMatchObject({ valueType: 'MULTI_CHOICE', sensitivity: 'MEDIUM' });
    expect(activities?.choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'ADMINISTRATIVE_SERVICES',
          label: 'Servicios administrativos',
        }),
      ]),
    );
  });

  it('rejects facts assigned to the wrong scope kind', () => {
    expect(() =>
      validateSstAssessmentFact(
        sstAssessmentFactSchema.parse({
          factKey: 'workCenter.hasChemicalProcesses',
          scopeKey: 'organization',
          answerState: 'KNOWN',
          value: false,
          provenance,
        }),
        scopes,
      ),
    ).toThrow('scope mismatch');
  });

  it('rejects unknown fact keys during canonical snapshot normalization', () => {
    expect(() =>
      normalizeSstAssessmentSnapshot(
        snapshot([
          {
            factKey: 'organization.notInCatalog',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: true,
            provenance,
          },
        ]),
      ),
    ).toThrow('Unknown assessment fact');
  });

  it('rejects invalid fact types and finite choices', () => {
    expect(() =>
      normalizeSstAssessmentSnapshot(
        snapshot([
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: 'false',
            provenance,
          },
        ]),
      ),
    ).toThrow('Expected boolean');
    expect(() =>
      normalizeSstAssessmentSnapshot(
        snapshot([
          {
            factKey: 'workCenter.facilityTypes',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: ['HOSPITAL_NOT_IN_CATALOG'],
            provenance,
          },
        ]),
      ),
    ).toThrow('Invalid choices');
  });

  it('rejects duplicate fact identities in a canonical snapshot', () => {
    const fact = sstAssessmentFactSchema.parse({
      factKey: 'organization.country',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 'EC',
      provenance,
    });
    expect(() => normalizeSstAssessmentSnapshot(snapshot([fact, fact]))).toThrow('Duplicate');
  });
});
