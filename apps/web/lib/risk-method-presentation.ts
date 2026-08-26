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
  if (methodKey === 'GUIDED_5X5') {
    return {
      displayName: 'Matriz 5×5 guiada',
      version,
      isDemo: true,
      statusLabel: 'Candidata DEMO',
      technicalKey: methodKey,
      contextSummary: 'Juicio profesional guiado con probabilidad y severidad humana.',
    };
  }
  if (methodKey === 'GTC45_2010') {
    return {
      displayName: 'GTC 45 · edición 2010',
      version,
      isDemo: true,
      statusLabel: 'Candidata para revisión',
      technicalKey: methodKey,
      contextSummary: 'Metodología técnica; su uso no implica adopción legal ecuatoriana.',
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
  GUIDED_5X5: 'guided-five-by-five',
  GTC45_2010: 'gtc45-2010',
} as const;

export function inspectionRiskMethodRenderer(methodKey: string) {
  return inspectionRiskMethodInputRenderers[
    methodKey as keyof typeof inspectionRiskMethodInputRenderers
  ];
}
