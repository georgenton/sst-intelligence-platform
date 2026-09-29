import { describe, expect, it } from 'vitest';
import {
  isSupportedJurisdiction,
  isSupportedJurisdictionCode,
  normalizeJurisdictionCode,
} from './jurisdiction';
import { SST_ASSESSMENT_FACT_CATALOG } from './sst-assessment-catalog';

describe('jurisdiction normalization', () => {
  it('recognizes the supported country aliases without creating a country database', () => {
    expect(normalizeJurisdictionCode('Ecuador')).toBe('EC');
    expect(normalizeJurisdictionCode(' ec ')).toBe('EC');
    expect(normalizeJurisdictionCode('Colombia')).toBe('CO');
    expect(normalizeJurisdictionCode('co')).toBe('CO');
    expect(normalizeJurisdictionCode('Perú')).toBe('PERÚ');
  });

  it('narrows only normalized jurisdiction codes', () => {
    const normalized = normalizeJurisdictionCode('Ecuador');
    expect(normalized).toBe('EC');
    expect(isSupportedJurisdictionCode(normalized!)).toBe(true);
    expect(isSupportedJurisdiction('Ecuador')).toBe(true);
    expect(isSupportedJurisdiction('CO')).toBe(false);
    expect(isSupportedJurisdictionCode('Ecuador')).toBe(false);
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

  it('keeps operational purposes neutral across jurisdictions', () => {
    for (const factKey of [
      'organization.totalWorkerCount',
      'workCenter.hasElectricalWorkOrExposure',
    ]) {
      const definition = SST_ASSESSMENT_FACT_CATALOG.find((item) => item.factKey === factKey);
      expect(definition?.purpose).toBeDefined();
      expect(definition?.purpose).not.toContain('Ecuador');
    }
  });
});
