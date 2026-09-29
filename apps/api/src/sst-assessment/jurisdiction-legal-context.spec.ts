import type {
  SstAssessmentFact,
  SstAssessmentQuestion,
  SstAssessmentSnapshot,
} from '@sst/contracts';
import {
  enrichAssessmentQuestions,
  resolveAssessmentQuestionLegalBasis,
} from './jurisdiction-legal-context';
import { resolveAssessmentFoundation } from './regulatory-foundation';

const scopes = [
  { scopeKey: 'organization', kind: 'ORGANIZATION' as const, order: 0, displayName: 'Empresa' },
  { scopeKey: 'center:1', kind: 'WORK_CENTER' as const, order: 1, displayName: 'Centro 1' },
];

function fact(
  factKey: string,
  scopeKey: string,
  value: string | number | boolean | string[],
): SstAssessmentFact {
  return {
    factKey,
    scopeKey,
    answerState: 'KNOWN',
    value,
    provenance: { source: 'PUBLIC_DECLARATION' },
  };
}

function snapshot(facts: SstAssessmentFact[]): SstAssessmentSnapshot {
  return { schemaVersion: '1.0.0', catalogVersion: '1.0.0', scopes, facts };
}

function question(
  factKey: string,
  scopeKey = 'organization',
): Pick<SstAssessmentQuestion, 'factKey' | 'scopeKey'> {
  return { factKey, scopeKey };
}

describe('jurisdiction-safe assessment legal context', () => {
  it('maps Ecuador organization headcount to verified Arts. 18, 19 and 20', () => {
    const basis = resolveAssessmentQuestionLegalBasis(
      snapshot([fact('organization.country', 'organization', 'Ecuador')]),
      question('organization.totalWorkerCount'),
    );
    expect(basis.status).toBe('VERIFIED');
    expect(basis.sources[0]).toEqual(
      expect.objectContaining({
        sourceKey: 'EC_MDT_2024_196',
        unitLocators: expect.arrayContaining([
          'Artículo 18 · página 16',
          'Artículo 19 · páginas 16–17',
          'Artículo 20 · páginas 17–18',
        ]),
      }),
    );
  });

  it('maps Ecuador center headcount to Art. 13 without calculating obligations', () => {
    const basis = resolveAssessmentQuestionLegalBasis(
      snapshot([fact('organization.country', 'organization', 'EC')]),
      question('workCenter.workerCount', 'center:1'),
    );
    expect(basis.status).toBe('VERIFIED');
    expect(basis.sources[0]?.unitLocators).toEqual(['Artículo 13 · páginas 13–14']);
    expect(basis.explanation).toMatch(/horas mínimas.*nivel de riesgo/);
  });

  it('requires electrical context before returning the Annex 3 basis', () => {
    const input = snapshot([
      fact('organization.country', 'organization', 'EC'),
      fact('workCenter.hasHighEnergyOperations', 'center:1', true),
    ]);
    expect(
      resolveAssessmentQuestionLegalBasis(
        input,
        question('workCenter.highEnergySourceTypes', 'center:1'),
      ).status,
    ).toBe('CONTEXT_REQUIRED');
    const electrical = snapshot([
      ...input.facts,
      fact('workCenter.highEnergySourceTypes', 'center:1', ['ELECTRICAL']),
    ]);
    expect(
      resolveAssessmentQuestionLegalBasis(
        electrical,
        question('workCenter.highEnergySourceTypes', 'center:1'),
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'VERIFIED',
        sources: [expect.objectContaining({ sourceKey: 'EC_MDT_2024_196_ANNEX_3' })],
      }),
    );
  });

  it('blocks Ecuador foundations for Colombia and preserves the operational path', () => {
    const input = snapshot([
      fact('organization.country', 'organization', 'Colombia'),
      fact('workCenter.hasHighEnergyOperations', 'center:1', true),
      fact('workCenter.highEnergySourceTypes', 'center:1', ['ELECTRICAL']),
    ]);
    const basis = resolveAssessmentQuestionLegalBasis(
      input,
      question('workCenter.hasElectricalWorkOrExposure', 'center:1'),
    );
    expect(basis).toEqual(
      expect.objectContaining({ status: 'JURISDICTION_NOT_SUPPORTED', sources: [] }),
    );
    expect(resolveAssessmentFoundation(input, 'center:1', ['HIGH_ENERGY_RULE'])).toEqual(
      expect.objectContaining({ status: 'JURISDICTION_NOT_SUPPORTED' }),
    );
  });

  it('recomputes a stored Ecuador basis after the country changes', () => {
    const storedQuestion = {
      ...question('organization.totalWorkerCount'),
      legalBasis: resolveAssessmentQuestionLegalBasis(
        snapshot([fact('organization.country', 'organization', 'EC')]),
        question('organization.totalWorkerCount'),
      ),
    } as SstAssessmentQuestion;
    const enriched = enrichAssessmentQuestions(
      snapshot([fact('organization.country', 'organization', 'Colombia')]),
      [storedQuestion],
    )[0];
    expect(enriched?.legalBasis).toEqual(
      expect.objectContaining({ status: 'JURISDICTION_NOT_SUPPORTED', sources: [] }),
    );
  });

  it('does not emit a foreign or synthetic source before country is known', () => {
    const basis = resolveAssessmentQuestionLegalBasis(
      snapshot([]),
      question('organization.totalWorkerCount'),
    );
    expect(basis).toEqual(
      expect.objectContaining({
        status: 'CONTEXT_REQUIRED',
        jurisdictionCode: 'UNKNOWN',
        sources: [],
      }),
    );
  });
});
