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
  },
  organization: {
    all: [...privateRoot, 'org'] as const,
    scope: (organizationId: string) => [...privateRoot, 'org', organizationId] as const,
    dashboard: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'dashboard'] as const,
    details: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'organization'] as const,
    members: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'members'] as const,
    entitlements: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'entitlements'] as const,
    subscription: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'subscription'] as const,
    inspectionContext: (organizationId: string) =>
      [...privateRoot, 'org', organizationId, 'inspections', 'context'] as const,
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
  },
} as const;

export function isPrivateQueryKey(queryKey: readonly unknown[]) {
  return queryKey[0] === privateRoot[0];
}
