import { describe, expect, it } from 'vitest';
import {
  analyzeRecurrence,
  assertInspectionTransition,
  calculateDemoRisk,
  DEMO_RISK_METHOD,
  findingClosureEligibility,
  isCorrectiveActionOverdue,
  recurrenceStatus,
  type RecurrenceCandidate,
} from './inspections';

describe('DEMO_5X5 risk engine', () => {
  it.each([
    [1, 1, 1, 'LOW'],
    [1, 4, 4, 'LOW'],
    [1, 5, 5, 'MODERATE'],
    [3, 3, 9, 'MODERATE'],
    [2, 5, 10, 'HIGH'],
    [4, 4, 16, 'HIGH'],
    [4, 5, 20, 'CRITICAL'],
    [5, 5, 25, 'CRITICAL'],
  ])('classifies %i x %i as %i %s', (likelihood, consequence, score, level) => {
    expect(calculateDemoRisk(likelihood as number, consequence as number)).toEqual({
      methodKey: 'DEMO_5X5',
      methodVersion: '1.0.0',
      likelihood,
      consequence,
      score,
      level,
    });
  });
  it.each([0, 1.5, 6, Number.NaN])('rejects invalid scale value %s', (value) => {
    expect(() => calculateDemoRisk(value, 1)).toThrow(RangeError);
    expect(() => calculateDemoRisk(1, value)).toThrow(RangeError);
  });
  it('returns version and non-regulatory definition', () => {
    expect(calculateDemoRisk(2, 2).methodVersion).toBe(DEMO_RISK_METHOD.version);
    expect(DEMO_RISK_METHOD.regulatory).toBe(false);
  });
});

describe('inspection transitions', () => {
  it.each([
    ['DRAFT', 'IN_PROGRESS'],
    ['DRAFT', 'CANCELED'],
    ['IN_PROGRESS', 'COMPLETED'],
    ['IN_PROGRESS', 'CANCELED'],
  ] as const)('allows %s -> %s', (from, to) =>
    expect(() => assertInspectionTransition(from, to)).not.toThrow(),
  );
  it.each([
    ['DRAFT', 'COMPLETED'],
    ['COMPLETED', 'IN_PROGRESS'],
    ['CANCELED', 'DRAFT'],
  ] as const)('rejects %s -> %s', (from, to) =>
    expect(() => assertInspectionTransition(from, to)).toThrow('Invalid inspection transition'),
  );
});

describe('finding closure', () => {
  it('rejects without actions', () =>
    expect(findingClosureEligibility({ actionStatuses: [], hasResidualRisk: true }).allowed).toBe(
      false,
    ));
  it('rejects without residual risk', () =>
    expect(
      findingClosureEligibility({ actionStatuses: ['COMPLETED'], hasResidualRisk: false }).allowed,
    ).toBe(false));
  it('accepts completed actions and residual risk', () =>
    expect(
      findingClosureEligibility({
        actionStatuses: ['COMPLETED', 'CANCELED'],
        hasResidualRisk: true,
      }).allowed,
    ).toBe(true));
});

describe('recurrence engine', () => {
  const now = new Date('2026-08-11T12:00:00Z');
  const current: RecurrenceCandidate = {
    organizationId: 'org-a',
    workCenterId: 'center-a',
    category: 'ELECTRICAL',
    createdAt: now,
  };
  const matching = (daysAgo: number): RecurrenceCandidate => ({
    ...current,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000),
  });
  it.each([
    [0, 'NONE'],
    [1, 'REPEATED'],
    [2, 'SYSTEMIC_REVIEW_RECOMMENDED'],
    [3, 'SYSTEMIC_REVIEW_RECOMMENDED'],
  ] as const)('maps %i to %s', (count, status) => expect(recurrenceStatus(count)).toBe(status));
  it('excludes other organization, center, category and window', () => {
    expect(
      analyzeRecurrence(
        current,
        [
          matching(10),
          { ...matching(10), organizationId: 'org-b' },
          { ...matching(10), workCenterId: 'center-b' },
          { ...matching(10), category: 'FIRE' },
          matching(91),
        ],
        now,
      ),
    ).toEqual({ count: 1, status: 'REPEATED', windowDays: 90 });
  });
});

describe('overdue actions', () => {
  const now = new Date('2026-08-11T12:00:00Z');
  const yesterday = new Date('2026-08-10T12:00:00Z');
  it('is overdue only while active and past due', () => {
    expect(isCorrectiveActionOverdue('OPEN', yesterday, now)).toBe(true);
    expect(isCorrectiveActionOverdue('COMPLETED', yesterday, now)).toBe(false);
    expect(isCorrectiveActionOverdue('CANCELED', yesterday, now)).toBe(false);
    expect(isCorrectiveActionOverdue('OPEN', null, now)).toBe(false);
  });
});
