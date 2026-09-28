import { describe, expect, it } from 'vitest';
import { compareHeadcountMeasures } from './sst-headcount.js';

const aligned = {
  meaning: 'USUAL_PRESENCE',
  period: '2026-09',
  coverage: 'ALL_ACTIVE_WORKERS',
  overlap: false,
} as const;

describe('headcount comparison', () => {
  it('compares only aligned magnitudes', () => {
    expect(
      compareHeadcountMeasures({ value: 60, ...aligned }, [
        { value: 40, ...aligned },
        { value: 15, ...aligned },
      ]),
    ).toEqual({ comparable: true, total: 60, sum: 55, difference: -5 });
  });

  it('keeps a different period incomparable', () => {
    expect(
      compareHeadcountMeasures({ value: 60, ...aligned }, [
        { value: 60, ...aligned, period: '2026-08' },
      ]),
    ).toEqual({ comparable: false, reason: 'PERIOD_MISMATCH' });
  });

  it('does not infer a distribution when overlap is not explicitly false', () => {
    expect(
      compareHeadcountMeasures({ value: 60, ...aligned, overlap: true }, [
        { value: 60, ...aligned, overlap: true },
      ]),
    ).toEqual({ comparable: false, reason: 'OVERLAP_UNCONFIRMED' });
  });
});
