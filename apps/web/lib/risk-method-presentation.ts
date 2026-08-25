export type RiskMethodPresentation = {
  displayName: string;
  version: string;
  isDemo: boolean;
  statusLabel: string;
  technicalKey: string;
  contextSummary?: string;
};

export function presentInspectionRiskMethod(
  methodKey: string,
  version: string,
): RiskMethodPresentation {
  if (methodKey === 'DEMO_5X5') {
    return {
      displayName: 'Matriz demostrativa 5×5',
      version,
      isDemo: true,
      statusLabel: 'Demostración',
      technicalKey: methodKey,
      contextSummary: 'Valoración histórica utilizada para este hallazgo.',
    };
  }
  return {
    displayName: 'Metodología registrada',
    version,
    isDemo: false,
    statusLabel: 'Registrada',
    technicalKey: methodKey,
  };
}

export const inspectionRiskMethodInputRenderers = {
  DEMO_5X5: 'demo-five-by-five',
} as const;

export function inspectionRiskMethodRenderer(methodKey: string) {
  return inspectionRiskMethodInputRenderers[
    methodKey as keyof typeof inspectionRiskMethodInputRenderers
  ];
}
