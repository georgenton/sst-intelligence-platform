export type HeadcountMeasure = {
  value: number;
  meaning?: string;
  period?: string;
  coverage?: string;
  overlap?: boolean;
};

export type HeadcountComparison =
  | { comparable: true; total: number; sum: number; difference: number }
  | { comparable: false; reason: HeadcountComparisonReason };

export type HeadcountComparisonReason =
  | 'INVALID_MAGNITUDE'
  | 'MEANING_MISMATCH'
  | 'PERIOD_MISMATCH'
  | 'COVERAGE_MISMATCH'
  | 'OVERLAP_UNCONFIRMED';

/**
 * A difference is meaningful only when every magnitude has the same declared
 * meaning, period and coverage. A center count cannot be reconciled with an
 * organization total when people may be counted in more than one center.
 */
export function compareHeadcountMeasures(
  organization: HeadcountMeasure,
  centers: readonly HeadcountMeasure[],
): HeadcountComparison {
  const magnitudes = [organization, ...centers];
  if (
    magnitudes.length < 2 ||
    magnitudes.some(({ value }) => !Number.isFinite(value) || value < 0)
  ) {
    return { comparable: false, reason: 'INVALID_MAGNITUDE' };
  }
  if (
    magnitudes.some(
      ({ meaning }) => !meaning || meaning === 'UNKNOWN' || meaning !== organization.meaning,
    )
  ) {
    return { comparable: false, reason: 'MEANING_MISMATCH' };
  }
  if (
    magnitudes.some(
      ({ period }) => !period?.trim() || period.trim() !== organization.period?.trim(),
    )
  ) {
    return { comparable: false, reason: 'PERIOD_MISMATCH' };
  }
  if (
    magnitudes.some(
      ({ coverage }) => !coverage || coverage === 'UNKNOWN' || coverage !== organization.coverage,
    )
  ) {
    return { comparable: false, reason: 'COVERAGE_MISMATCH' };
  }
  if (organization.overlap !== false || centers.some(({ overlap }) => overlap !== false)) {
    return { comparable: false, reason: 'OVERLAP_UNCONFIRMED' };
  }
  const sum = centers.reduce((total, { value }) => total + value, 0);
  return { comparable: true, total: organization.value, sum, difference: sum - organization.value };
}
