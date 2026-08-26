import { describe, expect, it } from 'vitest';
import {
  auditRegulatoryUnitCoverage,
  organizationRiskMethodPolicyInputSchema,
  regulatoryOfficialTextHash,
  type RegulatoryUnitRecord,
} from './regulatory-evidence';

function unit(overrides: Partial<RegulatoryUnitRecord> = {}): RegulatoryUnitRecord {
  const officialText = overrides.officialText ?? 'Artículo 1. Texto oficial.';
  return {
    id: '91000000-0000-4000-8000-000000000001',
    sourceVersionId: '92000000-0000-4000-8000-000000000001',
    parentUnitId: null,
    unitType: 'ARTICLE',
    identifier: 'ARTICLE_1',
    heading: null,
    ordinal: 1,
    officialText,
    editorialSummary: null,
    normalizedTextHash: regulatoryOfficialTextHash(officialText),
    pageStart: 1,
    pageEnd: 1,
    locator: 'Artículo 1 · página 1',
    extractionStatus: 'EXTRACTED',
    reviewStatus: 'VERIFIED',
    ...overrides,
  };
}

describe('regulatory evidence contracts', () => {
  it('reports structural completeness without presenting a legal completeness score', () => {
    const units = [
      unit(),
      unit({ id: '91000000-0000-4000-8000-000000000002', identifier: 'ARTICLE_2', ordinal: 2 }),
    ];
    expect(auditRegulatoryUnitCoverage(units, ['ARTICLE_1', 'ARTICLE_2'])).toMatchObject({
      coveragePercent: 100,
      complete: true,
      duplicateIdentifiers: [],
      missingIdentifiers: [],
    });
  });

  it('detects missing units, unresolved pages, invalid parent and changed official text hash', () => {
    const result = auditRegulatoryUnitCoverage(
      [
        unit({
          parentUnitId: '91000000-0000-4000-8000-000000000099',
          pageStart: null,
          pageEnd: null,
          normalizedTextHash: regulatoryOfficialTextHash('otro'),
        }),
      ],
      ['ARTICLE_1', 'ARTICLE_2'],
    );
    expect(result).toMatchObject({
      coveragePercent: 50,
      complete: false,
      missingIdentifiers: ['ARTICLE_2'],
      unresolvedPageIdentifiers: ['ARTICLE_1'],
      invalidParentIdentifiers: ['ARTICLE_1'],
      hashMismatchIdentifiers: ['ARTICLE_1'],
    });
  });

  it('requires the organization default method to be one of the allowed exact versions', () => {
    expect(() =>
      organizationRiskMethodPolicyInputSchema.parse({
        allowedRiskMethodVersionIds: ['91000000-0000-4000-8000-000000000001'],
        defaultRiskMethodVersionId: '91000000-0000-4000-8000-000000000002',
      }),
    ).toThrow('DEFAULT_RISK_METHOD_MUST_BE_ALLOWED');
  });
});
