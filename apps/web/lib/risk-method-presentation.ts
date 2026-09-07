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

const deficiencyLabels: Record<string, string> = {
  VERY_HIGH: 'Muy alto',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
};

const exposureLabels: Record<number, string> = {
  4: 'Continua',
  3: 'Frecuente',
  2: 'Ocasional',
  1: 'Esporádica',
};

const probabilityLabels: Record<string, string> = {
  VERY_HIGH: 'Muy alto',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
};

const consequenceLabels: Record<number, string> = {
  100: 'Mortal o catastrófica',
  60: 'Muy grave',
  25: 'Grave',
  10: 'Leve',
};

export type Gtc45HumanResult = {
  methodology: string;
  deficiency: string;
  exposure: string;
  probability: string;
  consequence: string;
  risk: string;
  intervention: string;
  interpretation: string;
};

export function presentGtc45Result(result: Record<string, unknown>): Gtc45HumanResult | null {
  if (result.methodKey !== 'GTC45_2010') return null;
  const trace = result.trace;
  if (!trace || typeof trace !== 'object') return null;
  const record = trace as Record<string, unknown>;
  const deficiency = record.deficiency as Record<string, unknown> | undefined;
  const probability = record.probability as Record<string, unknown> | undefined;
  const deficiencySelection = String(deficiency?.selection ?? '');
  const deficiencyValue = result.deficiencyValue;
  const exposureValue = Number(probability?.exposureValue);
  const consequenceValue = Number(result.consequenceValue);
  const probabilityValue = result.probabilityValue;
  const probabilityBand = String(result.probabilityBand ?? '');
  const riskValue = result.riskValue;
  const interventionLevel = String(result.riskLevel ?? '');
  if (!deficiencyLabels[deficiencySelection] || !exposureLabels[exposureValue]) return null;
  return {
    methodology: `GTC45_2010 · v${String(result.methodVersion ?? 'no registrada')}`,
    deficiency: `${deficiencyLabels[deficiencySelection]} · ND ${deficiencyValue ?? 'no numérico'}`,
    exposure: `${exposureLabels[exposureValue]} · NE ${exposureValue}`,
    probability:
      probabilityValue === null
        ? 'NP no aplicado por tratamiento especial de deficiencia baja'
        : `${probabilityLabels[probabilityBand] ?? 'Registrada'} · NP ${String(probabilityValue)}`,
    consequence: `${consequenceLabels[consequenceValue] ?? 'Registrada'} · NC ${consequenceValue}`,
    risk:
      riskValue === null
        ? 'NR no aplicado por tratamiento especial de deficiencia baja'
        : `NR ${String(riskValue)}`,
    intervention: `Nivel de intervención ${interventionLevel}`,
    interpretation:
      interventionLevel === 'I'
        ? 'Rango canónico registrado: NR entre 600 y 4000.'
        : interventionLevel === 'II'
          ? 'Rango canónico registrado: NR entre 150 y 500.'
          : interventionLevel === 'III'
            ? 'Rango canónico registrado: NR entre 40 y 120.'
            : riskValue === null
              ? 'Tratamiento especial registrado: deficiencia baja conduce directamente al nivel IV.'
              : 'Rango canónico registrado: NR igual a 20.',
  };
}
