import { describe, expect, it } from 'vitest';
import {
  assertIncidentActionTransition,
  assertIncidentTransition,
  assertPpeIssueTransition,
  assertTrainingSessionTransition,
  assertWorkerDateRange,
  canReceiveNewWorkerAssignment,
  incidentClosureEligibility,
  deriveWorkerCompetencyStatus,
  isPpeReplacementDue,
  ppeConditionRequiresReview,
} from './workforce-safety.js';

describe('worker registry rules', () => {
  it('allows new assignments only for active workers', () => {
    expect(canReceiveNewWorkerAssignment('ACTIVE')).toBe(true);
    expect(canReceiveNewWorkerAssignment('INACTIVE')).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(() => assertWorkerDateRange(new Date('2026-08-10'), new Date('2026-08-09'))).toThrow(
      RangeError,
    );
    expect(() =>
      assertWorkerDateRange(new Date('2026-08-10'), new Date('2026-08-10')),
    ).not.toThrow();
  });
});

describe('incident management rules', () => {
  it('keeps reporting, investigation, actions and closure explicit', () => {
    expect(() => assertIncidentTransition('DRAFT', 'REPORTED')).not.toThrow();
    expect(() => assertIncidentTransition('REPORTED', 'UNDER_INVESTIGATION')).not.toThrow();
    expect(() => assertIncidentTransition('UNDER_INVESTIGATION', 'CLOSED')).not.toThrow();
    expect(() => assertIncidentTransition('CLOSED', 'UNDER_INVESTIGATION')).toThrow();
  });

  it('requires verification before completing an incident action', () => {
    expect(() => assertIncidentActionTransition('OPEN', 'PENDING_VERIFICATION')).not.toThrow();
    expect(() => assertIncidentActionTransition('PENDING_VERIFICATION', 'COMPLETED')).not.toThrow();
    expect(() => assertIncidentActionTransition('OPEN', 'COMPLETED')).toThrow();
  });

  it('closes only after investigation and every active action are complete', () => {
    expect(
      incidentClosureEligibility({
        investigationStatus: 'IN_PROGRESS',
        actionStatuses: ['COMPLETED'],
      }).allowed,
    ).toBe(false);
    expect(
      incidentClosureEligibility({
        investigationStatus: 'COMPLETED',
        actionStatuses: ['PENDING_VERIFICATION'],
      }).allowed,
    ).toBe(false);
    expect(
      incidentClosureEligibility({
        investigationStatus: 'COMPLETED',
        actionStatuses: ['COMPLETED', 'CANCELLED'],
      }).allowed,
    ).toBe(true);
  });
});

describe('PPE lifecycle', () => {
  it('keeps replacement as a new historical issue', () => {
    expect(() => assertPpeIssueTransition('REPLACEMENT_DUE', 'REPLACED')).not.toThrow();
    expect(() => assertPpeIssueTransition('REPLACED', 'IN_SERVICE')).toThrow(
      'INVALID_PPE_ISSUE_TRANSITION',
    );
  });

  it('derives replacement due without rewriting terminal history', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    expect(
      isPpeReplacementDue({
        status: 'IN_SERVICE',
        expectedReplacementAt: new Date('2026-08-31T00:00:00.000Z'),
        now,
      }),
    ).toBe(true);
    expect(
      isPpeReplacementDue({
        status: 'REPLACED',
        expectedReplacementAt: new Date('2026-08-31T00:00:00.000Z'),
        now,
      }),
    ).toBe(false);
    expect(ppeConditionRequiresReview('SERVICEABLE')).toBe(false);
    expect(ppeConditionRequiresReview('UNSERVICEABLE')).toBe(true);
  });
});

describe('training and competency lifecycle', () => {
  it('keeps the session lifecycle finite', () => {
    expect(() => assertTrainingSessionTransition('DRAFT', 'SCHEDULED')).not.toThrow();
    expect(() => assertTrainingSessionTransition('SCHEDULED', 'COMPLETED')).not.toThrow();
    expect(() => assertTrainingSessionTransition('COMPLETED', 'SCHEDULED')).toThrow(
      'INVALID_TRAINING_SESSION_TRANSITION',
    );
  });

  it('derives current, due, expired and not-completed states from history', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    expect(deriveWorkerCompetencyStatus({ completionExists: false, validUntil: null, now })).toBe(
      'NOT_COMPLETED',
    );
    expect(
      deriveWorkerCompetencyStatus({
        completionExists: true,
        validUntil: new Date('2026-09-15T00:00:00.000Z'),
        now,
      }),
    ).toBe('DUE_SOON');
    expect(
      deriveWorkerCompetencyStatus({
        completionExists: true,
        validUntil: new Date('2026-08-31T00:00:00.000Z'),
        now,
      }),
    ).toBe('EXPIRED');
    expect(
      deriveWorkerCompetencyStatus({
        completionExists: true,
        validUntil: new Date('2027-09-01T00:00:00.000Z'),
        now,
      }),
    ).toBe('CURRENT');
  });
});
