const publicRoot = ['public'] as const;
const globalRoot = ['global'] as const;
const privateRoot = ['private'] as const;

export const queryKeys = {
  public: {
    all: publicRoot,
    solutionFinder: {
      all: [...publicRoot, 'solution-finder'] as const,
      session: (sessionId: string) =>
        [...publicRoot, 'solution-finder', 'session', sessionId] as const,
      result: (sessionId: string) =>
        [...publicRoot, 'solution-finder', 'result', sessionId] as const,
    },
  },
  global: {
    all: globalRoot,
    moduleCatalog: () => [...globalRoot, 'module-catalog'] as const,
  },
  user: {
    all: [...privateRoot, 'user'] as const,
    scope: (userId: string) => [...privateRoot, 'user', userId] as const,
    organizations: (userId: string) => [...privateRoot, 'user', userId, 'organizations'] as const,
    invitationPreview: (userId: string) =>
      [...privateRoot, 'user', userId, 'organization-invitation'] as const,
  },
  organization: {
    all: [...privateRoot, 'org'] as const,
    scope: (organizationId: string) => [...privateRoot, 'org', organizationId] as const,
    dashboard: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'dashboard'] as const,
    conversationThreads: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'conversations'] as const,
    conversationThread: (organizationId: string, threadId: string) =>
      [...privateRoot, 'org', organizationId, 'conversations', threadId] as const,
    workQueueRoot: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'work-queue'] as const,
    workQueue: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'work-queue', filters] as const,
    obligations: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'obligations', filters] as const,
    obligation: (organizationId: string, obligationId: string) =>
      [...privateRoot, 'org', organizationId, 'obligations', obligationId] as const,
    workPermitTemplates: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'work-permits', 'templates'] as const,
    workPermitApprovers: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'work-permits', 'approvers'] as const,
    workPermits: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'work-permits', 'list'] as const,
    workPermit: (organizationId: string, permitId: string) =>
      [...privateRoot, 'org', organizationId, 'work-permits', permitId] as const,
    details: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'organization'] as const,
    workCenters: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'work-centers'] as const,
    members: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'members'] as const,
    workers: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'workers', 'list', filters] as const,
    worker: (organizationId: string, workerId: string) =>
      [...privateRoot, 'org', organizationId, 'workers', 'detail', workerId] as const,
    incidents: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'incidents', 'list', filters] as const,
    incident: (organizationId: string, incidentId: string) =>
      [...privateRoot, 'org', organizationId, 'incidents', 'detail', incidentId] as const,
    incidentAnalytics: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'incidents', 'analytics'] as const,
    ppeCatalog: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'ppe', 'catalog', filters] as const,
    workerPpe: (organizationId: string, workerId: string) =>
      [...privateRoot, 'org', organizationId, 'ppe', 'worker', workerId] as const,
    trainingDefinitions: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'training', 'definitions', filters] as const,
    trainingSessions: (organizationId: string, filters = '') =>
      [...privateRoot, 'org', organizationId, 'training', 'sessions', filters] as const,
    trainingSession: (organizationId: string, sessionId: string) =>
      [...privateRoot, 'org', organizationId, 'training', 'session', sessionId] as const,
    governanceBodies: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'governance', 'bodies'] as const,
    governanceBody: (organizationId: string, bodyId: string) =>
      [...privateRoot, 'org', organizationId, 'governance', 'body', bodyId] as const,
    workerTraining: (organizationId: string, workerId: string) =>
      [...privateRoot, 'org', organizationId, 'training', 'worker', workerId] as const,
    invitations: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'invitations'] as const,
    entitlements: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'entitlements'] as const,
    subscription: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'subscription'] as const,
    inspectionContext: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'context'] as const,
    riskMethods: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'risk-methods'] as const,
    inspectionStandardCatalog: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspection-standards', 'catalog'] as const,
    inspectionStandardPolicy: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspection-standards', 'policy'] as const,
    inspectionBases: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspection-bases'] as const,
    inspectionBasisActive: (organizationId: string, domain: string) =>
      [...privateRoot, 'org', organizationId, 'inspection-bases', 'active', domain] as const,
    inspectionBasisRegulatoryUnits: (organizationId: string, search: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'inspection-bases',
        'regulatory-units',
        search,
      ] as const,
    inspections: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'list'] as const,
    inspectionList: (organizationId: string, filters: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'list', filters] as const,
    inspection: (organizationId: string, inspectionId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'detail', inspectionId] as const,
    finding: (organizationId: string, findingId: string) =>
      [...privateRoot, 'org', organizationId, 'findings', 'detail', findingId] as const,
    inspectionAlerts: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'alerts'] as const,
    inspectionAlertList: (organizationId: string, filters: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'alerts', filters] as const,
    inspectionAnalytics: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'analytics'] as const,
    inspectionAnalyticsSummary: (organizationId: string, filters: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'analytics', filters] as const,
    technicalRiskAssessments: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'technical-risk', 'assessments'] as const,
    technicalRiskMethods: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'technical-risk', 'methods'] as const,
    technicalRiskContext: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'technical-risk', 'context'] as const,
    technicalRiskAssessment: (organizationId: string, assessmentId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'technical-risk',
        'assessment',
        assessmentId,
      ] as const,
    applicabilityProfileVersions: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'applicability', 'profile-versions'] as const,
    applicabilityRulePacks: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'applicability', 'rule-packs'] as const,
    applicabilityAssessments: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'applicability', 'assessments'] as const,
    applicabilityAssessment: (organizationId: string, assessmentId: string) =>
      [...privateRoot, 'org', organizationId, 'applicability', 'assessment', assessmentId] as const,
    adaptiveRulePacks: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'adaptive-configuration', 'rule-packs'] as const,
    adaptiveSessions: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'adaptive-configuration', 'sessions'] as const,
    adaptiveSession: (organizationId: string, sessionId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'adaptive-configuration',
        'session',
        sessionId,
      ] as const,
    adaptiveQuestions: (organizationId: string, sessionId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'adaptive-configuration',
        'questions',
        sessionId,
      ] as const,
    adaptiveRuns: (organizationId: string, sessionId: string) =>
      [...privateRoot, 'org', organizationId, 'adaptive-configuration', 'runs', sessionId] as const,
    adaptiveProposals: (organizationId: string, sessionId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'adaptive-configuration',
        'proposals',
        sessionId,
      ] as const,
    adaptiveProposal: (organizationId: string, proposalId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'adaptive-configuration',
        'proposal',
        proposalId,
      ] as const,
    regulatorySources: (organizationId: string, filters: string) =>
      [...privateRoot, 'org', organizationId, 'regulatory-sources', 'list', filters] as const,
    regulatorySource: (organizationId: string, sourceKey: string) =>
      [...privateRoot, 'org', organizationId, 'regulatory-sources', 'detail', sourceKey] as const,
    regulatorySourceVersions: (organizationId: string, sourceKey: string) =>
      [...privateRoot, 'org', organizationId, 'regulatory-sources', 'versions', sourceKey] as const,
    regulatorySourceRelationships: (organizationId: string, sourceKey: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'regulatory-sources',
        'relationships',
        sourceKey,
      ] as const,
    regulatorySourceProvisions: (organizationId: string, sourceKey: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'regulatory-sources',
        'provisions',
        sourceKey,
      ] as const,
    regulatorySourceUnits: (organizationId: string, sourceKey: string, filters = '') =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'regulatory-sources',
        'units',
        sourceKey,
        filters,
      ] as const,
    regulatoryUnit: (organizationId: string, unitId: string) =>
      [...privateRoot, 'org', organizationId, 'regulatory-units', 'detail', unitId] as const,
    unifiedSstEvaluations: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'unified-sst-evaluations', 'list'] as const,
    unifiedSstEvaluation: (organizationId: string, evaluationId: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'unified-sst-evaluations',
        'detail',
        evaluationId,
      ] as const,
    regulatoryRequirements: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'regulatory-requirements', 'list'] as const,
    regulatoryRequirement: (organizationId: string, requirementKey: string) =>
      [
        ...privateRoot,
        'org',
        organizationId,
        'regulatory-requirements',
        'detail',
        requirementKey,
      ] as const,
  },
} as const;

export function isPrivateQueryKey(queryKey: readonly unknown[]) {
  return queryKey[0] === privateRoot[0];
}
