import { describe, expect, it } from 'vitest';
import {
  assertObligationExecutionTransition,
  assertWorkPermitTransition,
  obligationReviewTargetStatus,
  workQueuePriorityRank,
} from './operational-execution.js';

describe('operational execution lifecycle', () => {
  it('allows the bounded execution and professional-review paths', () => {
    expect(() => assertObligationExecutionTransition('OPEN', 'IN_PROGRESS')).not.toThrow();
    expect(() =>
      assertObligationExecutionTransition('IN_PROGRESS', 'READY_FOR_REVIEW'),
    ).not.toThrow();
    expect(obligationReviewTargetStatus('READY_FOR_REVIEW', 'APPROVED')).toBe('COMPLETED');
    expect(obligationReviewTargetStatus('READY_FOR_REVIEW', 'NEEDS_REVISION')).toBe('IN_PROGRESS');
  });

  it('rejects terminal rewrites and review outside the review state', () => {
    expect(() => assertObligationExecutionTransition('COMPLETED', 'IN_PROGRESS')).toThrow(
      'INVALID_OBLIGATION_EXECUTION_TRANSITION',
    );
    expect(() => obligationReviewTargetStatus('IN_PROGRESS', 'APPROVED')).toThrow(
      'OBLIGATION_NOT_READY_FOR_REVIEW',
    );
  });
});

describe('work permit lifecycle', () => {
  it('keeps approval, activation, suspension and closure explicit', () => {
    expect(() => assertWorkPermitTransition('DRAFT', 'PENDING_APPROVAL')).not.toThrow();
    expect(() => assertWorkPermitTransition('PENDING_APPROVAL', 'AUTHORIZED')).not.toThrow();
    expect(() => assertWorkPermitTransition('AUTHORIZED', 'ACTIVE')).not.toThrow();
    expect(() => assertWorkPermitTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
    expect(() => assertWorkPermitTransition('SUSPENDED', 'CLOSED')).not.toThrow();
  });

  it('does not skip authorization or reopen a closed permit', () => {
    expect(() => assertWorkPermitTransition('DRAFT', 'ACTIVE')).toThrow(
      'INVALID_WORK_PERMIT_TRANSITION',
    );
    expect(() => assertWorkPermitTransition('CLOSED', 'ACTIVE')).toThrow(
      'INVALID_WORK_PERMIT_TRANSITION',
    );
  });
});

describe('work queue ordering', () => {
  it('keeps deterministic cross-module precedence without comparing risk scores', () => {
    const rank = (input: Parameters<typeof workQueuePriorityRank>[0]) =>
      workQueuePriorityRank(input);
    expect(
      rank({ overdue: true, priority: 'HIGH', status: 'OPEN', type: 'CORRECTIVE_ACTION' }),
    ).toBeLessThan(
      rank({ overdue: false, priority: 'HIGH', status: 'OPEN', type: 'TECHNICAL_REVIEW' }),
    );
    expect(
      rank({ overdue: false, priority: 'MEDIUM', status: 'OPEN', type: 'TECHNICAL_REVIEW' }),
    ).toBeLessThan(
      rank({ overdue: false, priority: 'MEDIUM', status: 'BLOCKED', type: 'OBLIGATION_EXECUTION' }),
    );
  });
});
