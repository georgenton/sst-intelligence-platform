import type {
  ApplicabilityPredicateTrace,
  ApplicabilityRulePack,
  ApplicabilitySourceType,
  ApplicabilityState,
  OrganizationSstProfile,
  RuleResult,
} from '@sst/contracts';

export type ApplicabilityProfileVersion = {
  id: string;
  version: number;
  snapshot: OrganizationSstProfile;
  createdAt: string;
  createdBy?: { id: string; displayName: string };
};

export type ApplicabilityRulePackOption = {
  id: string;
  key: string;
  name: string;
  version: string;
  status: string;
  sourceType: ApplicabilitySourceType;
  sourceReference: string | null;
  regulatory: boolean;
  isDemo: boolean;
  disclaimer: string;
  activatedAt: string | null;
};

export type ApplicabilityAssessmentSummary = {
  id: string;
  engineVersion: string;
  completedAt: string;
  createdAt: string;
  profileVersion: { id: string; version: number };
  rulePackVersion: { id: string; key: string; version: string; isDemo: boolean };
  _count: { decisions: number };
};

export type ApplicabilityTraceRecord = {
  id: string;
  ruleId: string;
  targetKey: string;
  composition: 'ALL' | 'ANY';
  ruleResult: RuleResult;
  configuredState: ApplicabilityState;
  contributedState: ApplicabilityState | null;
  reasonCode: string;
  explanation: string;
  predicates: ApplicabilityPredicateTrace[];
};

export type ApplicabilityDecisionRecord = {
  id: string;
  targetKey: string;
  state: ApplicabilityState;
  reasonCode: string;
  explanation: string;
  sourceType: ApplicabilitySourceType;
  sourceReference: string | null;
  winningRuleId: string | null;
  traces: ApplicabilityTraceRecord[];
};

export type ApplicabilityAssessmentDetailRecord = {
  id: string;
  engineVersion: string;
  completedAt: string;
  createdAt: string;
  profileSnapshot: OrganizationSstProfile;
  rulePackSnapshot: ApplicabilityRulePack;
  profileVersion: { id: string; version: number };
  rulePackVersion: {
    id: string;
    key: string;
    name: string;
    version: string;
    sourceType: ApplicabilitySourceType;
    sourceReference: string | null;
    regulatory: boolean;
    isDemo: boolean;
    disclaimer: string;
  };
  createdBy: { id: string; displayName: string };
  decisions: ApplicabilityDecisionRecord[];
};
