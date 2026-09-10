import { describe, expect, it } from 'vitest';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_FACT_CATALOG,
  SST_ASSESSMENT_SCHEMA_VERSION,
  calculateSstAssessmentProgress,
  normalizeSstAssessmentSnapshot,
  planSstAssessmentQuestions,
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
    expect(progress.totalTopics).toBeGreaterThan(5);
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
