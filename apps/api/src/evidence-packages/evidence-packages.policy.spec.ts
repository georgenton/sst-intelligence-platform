import { EVIDENCE_REFERENCE_ENTITLEMENTS } from './evidence-packages.policy';

describe('evidence package reference entitlement policy', () => {
  it('maps every finite source type to its canonical module entitlement or none', () => {
    expect(EVIDENCE_REFERENCE_ENTITLEMENTS).toEqual({
      INSPECTION: 'module.inspections',
      FINDING: 'module.inspections',
      CORRECTIVE_ACTION: 'module.inspections',
      ACTION_EVIDENCE: 'module.inspections',
      TECHNICAL_ASSESSMENT: 'module.technical_risk',
      INCIDENT: 'module.incidents',
      PPE_ISSUE: 'module.ppe',
      TRAINING_COMPLETION: 'module.training',
      WORK_PERMIT: 'module.work_permits',
      OBLIGATION_EXECUTION: null,
      GOVERNANCE_MEETING: null,
      GOVERNANCE_DECISION: null,
      REGULATORY_UNIT: null,
      INSPECTION_BASIS_VERSION: 'module.inspections',
    });
  });
});
