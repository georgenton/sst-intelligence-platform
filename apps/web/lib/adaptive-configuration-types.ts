export type AdaptivePackOption = {
  id: string;
  version: string;
  engineSchemaVersion: string;
  disclaimer: string;
  isDemo: boolean;
  regulatory: boolean;
  contentHash: string;
  publishedAt: string;
  packDefinition: { packKey: string; name: string };
};

export type AdaptiveSessionSummary = {
  id: string;
  status: 'COLLECTING_INFORMATION' | 'READY_TO_PROPOSE' | 'FINALIZED' | 'CANCELLED';
  sessionRevision: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  profileVersion: { id: string; version: number };
  rulePackVersion: {
    id: string;
    version: string;
    packDefinition: { packKey: string; name: string };
  };
  runs: Array<{
    runNumber: number;
    _count: { questions: number };
    proposal: { id: string; proposalVersion: number } | null;
  }>;
};

export type AdaptiveQuestion = {
  id: string;
  questionText: string;
  helpText: string;
  answerChoices: string[];
  whyAsked: string;
  sortOrder: number;
  scope: {
    id: string;
    scopeKey: string;
    displayNameSnapshot: string;
    kind: 'ORGANIZATION' | 'WORK_CENTER';
  };
  factVersion: {
    id: string;
    valueType: 'BOOLEAN' | 'INTEGER' | 'DECIMAL' | 'SHORT_TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
    unknownAllowed: boolean;
    factDefinition: { factKey: string };
  };
};

export type AdaptiveSessionDetail = {
  id: string;
  status: AdaptiveSessionSummary['status'];
  sessionRevision: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  profileVersion: { id: string; version: number; snapshot: unknown };
  rulePackVersion: AdaptivePackOption;
  scopes: Array<{
    id: string;
    scopeKey: string;
    kind: 'ORGANIZATION' | 'WORK_CENTER';
    displayNameSnapshot: string;
    sortOrder: number;
  }>;
  runs: Array<{
    id: string;
    runNumber: number;
    sessionRevision: number;
    questions: AdaptiveQuestion[];
    proposal: { id: string; proposalVersion: number } | null;
  }>;
};

export type AdaptiveProposal = {
  id: string;
  proposalVersion: number;
  createdAt: string;
  evaluationRun: {
    id: string;
    runNumber: number;
    sessionRevision: number;
    engineVersion: string;
    outputHash: string;
  };
  session: {
    id: string;
    status: AdaptiveSessionSummary['status'];
    sessionRevision: number;
    rulePackVersion: {
      version: string;
      disclaimer: string;
      packDefinition: { packKey: string; name: string };
    };
  };
  items: AdaptiveProposalItem[];
};

export type AdaptiveProposalItem = {
  id: string;
  state: string;
  minimumDepth: 'BASIC_VISIBLE' | 'TECHNICAL' | 'SYSTEMIC' | 'UNDETERMINED';
  professionalReview: boolean;
  reason: string;
  ruleVersionProvenance: string[];
  requirementProvenance: string[];
  evidenceSuggestions: string[];
  missingFacts: string[];
  trace: unknown[];
  scope: {
    id: string;
    scopeKey: string;
    kind: 'ORGANIZATION' | 'WORK_CENTER';
    displayNameSnapshot: string;
  };
  targetVersion: {
    title: string;
    description: string;
    currentStateQuestion: string;
    targetDefinition: { targetKey: string };
  };
  currentState: {
    id: string;
    status: string;
    evidence: Array<{
      id: string;
      type: 'NOTE' | 'EXTERNAL_LINK';
      note: string | null;
      externalUrl: string | null;
      declaredAt: string;
    }>;
  } | null;
};
