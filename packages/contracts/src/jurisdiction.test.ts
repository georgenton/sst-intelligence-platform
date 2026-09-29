import { describe, expect, it } from 'vitest';
import { normalizeJurisdictionCode } from './jurisdiction';
import { SST_ASSESSMENT_FACT_CATALOG } from './sst-assessment-catalog';

describe('jurisdiction normalization', () => {
  it('recognizes the supported country aliases without creating a country database', () => {
    expect(normalizeJurisdictionCode('Ecuador')).toBe('EC');
    expect(normalizeJurisdictionCode(' ec ')).toBe('EC');
    expect(normalizeJurisdictionCode('Colombia')).toBe('CO');
    expect(normalizeJurisdictionCode('co')).toBe('CO');
    expect(normalizeJurisdictionCode('Perú')).toBe('PERÚ');
  });
});

describe('assessment purpose copy', () => {
  it('does not expose the generic context fallback in active questions', () => {
    expect(
      SST_ASSESSMENT_FACT_CATALOG.every(
        ({ purpose }) => !purpose.includes('Completar el contexto de'),
      ),
    ).toBe(true);
    expect(SST_ASSESSMENT_FACT_CATALOG.every(({ purpose }) => purpose.trim().length > 20)).toBe(
      true,
    );
  });
});
