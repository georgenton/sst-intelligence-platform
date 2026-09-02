import { describe, expect, it } from 'vitest';
import {
  assertGovernanceActionTransition,
  assertGovernanceMeetingTransition,
  governanceRegulatoryReferenceLabel,
} from './governance';

describe('governance contracts', () => {
  it('keeps the bounded meeting lifecycle deterministic', () => {
    expect(() => assertGovernanceMeetingTransition('DRAFT', 'SCHEDULED')).not.toThrow();
    expect(() => assertGovernanceMeetingTransition('SCHEDULED', 'HELD')).not.toThrow();
    expect(() => assertGovernanceMeetingTransition('HELD', 'DRAFT')).toThrow(
      'INVALID_GOVERNANCE_MEETING_TRANSITION:HELD:DRAFT',
    );
  });

  it('keeps decisions separate from action execution state', () => {
    expect(() => assertGovernanceActionTransition('OPEN', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertGovernanceActionTransition('IN_PROGRESS', 'COMPLETED')).not.toThrow();
    expect(() => assertGovernanceActionTransition('COMPLETED', 'OPEN')).toThrow(
      'INVALID_GOVERNANCE_ACTION_TRANSITION:COMPLETED:OPEN',
    );
  });

  it('does not promote unreviewed regulatory references into legal mandates', () => {
    expect(
      governanceRegulatoryReferenceLabel({
        unitReviewStatus: 'UNREVIEWED',
        requirementEditorialStatus: 'CANDIDATE',
      }),
    ).toBe('REFERENCIA_CANDIDATA');
    expect(
      governanceRegulatoryReferenceLabel({
        unitReviewStatus: 'APPROVED',
        requirementEditorialStatus: null,
      }),
    ).toBe('REFERENCIA_REVISADA');
    expect(governanceRegulatoryReferenceLabel({})).toBe('SIN_REFERENCIA');
  });
});
