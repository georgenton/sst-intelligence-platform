import type { SolutionAnswers, SolutionRecommendation } from './schemas.js';

export const RECOMMENDATION_ENGINE_VERSION = '1.0.0';

type Candidate = SolutionRecommendation['recommendedModules'][number];

function priority(score: number): Candidate['priority'] {
  return score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
}

function candidate(
  moduleKey: Candidate['moduleKey'],
  rawScore: number,
  reasons: string[],
): Candidate {
  const score = Math.min(100, rawScore);
  return { moduleKey, score, priority: priority(score), reasons };
}

export function suggestPlan(answers: SolutionAnswers, moduleCount: number) {
  if (answers.estimatedUsers > 100 || answers.workerRange === 'MORE_1000')
    return 'ENTERPRISE' as const;
  if (answers.estimatedUsers > 25 || moduleCount >= 4 || answers.workCenters > 8)
    return 'GROWTH' as const;
  return 'STARTER' as const;
}

export function buildRollout(
  modules: Candidate[],
  answers: Pick<SolutionAnswers, 'budgetRange' | 'rolloutPreference'>,
) {
  const ordered = modules
    .filter(({ moduleKey }) => moduleKey !== 'CORE')
    .map((item) => item.moduleKey);
  if (ordered.length === 0) return [{ phase: 1, modules: ['CORE'] as Candidate['moduleKey'][] }];
  const phased = answers.rolloutPreference === 'GRADUAL' || answers.budgetRange === 'LOW';
  if (!phased) return [{ phase: 1, modules: ordered }];
  const firstSize = answers.budgetRange === 'LOW' ? 1 : 2;
  return [
    { phase: 1, modules: ordered.slice(0, firstSize) },
    ...(ordered.length > firstSize ? [{ phase: 2, modules: ordered.slice(firstSize) }] : []),
  ];
}

export function calculateRecommendation(answers: SolutionAnswers): SolutionRecommendation {
  const modules: Candidate[] = [candidate('CORE', 100, ['Base para administrar la organización'])];

  const inspectionReasons: string[] = [];
  let inspectionScore = 0;
  if (answers.workCenters > 1) {
    inspectionScore += 25;
    inspectionReasons.push('La empresa administra varios centros de trabajo');
  }
  if (answers.managementSystem !== 'SOFTWARE') {
    inspectionScore += 25;
    inspectionReasons.push(
      answers.managementSystem === 'SPREADSHEETS'
        ? 'El seguimiento se realiza en hojas de cálculo'
        : 'El seguimiento se realiza en papel',
    );
  }
  if (answers.recurringFindings) {
    inspectionScore += 35;
    inspectionReasons.push('Existen hallazgos recurrentes');
  }
  if (answers.overdueActions) {
    inspectionScore += 15;
    inspectionReasons.push('Existen acciones vencidas');
  }
  if (inspectionScore >= 45)
    modules.push(candidate('INSPECTIONS_INTELLIGENCE', inspectionScore, inspectionReasons));

  const permitReasons: string[] = [];
  const hazardousTasks = [
    answers.workAtHeight,
    answers.hotWork,
    answers.electricity,
    answers.chemicals,
  ].filter(Boolean).length;
  let permitScore = answers.criticalActivities ? 35 : hazardousTasks * 12;
  if (answers.criticalActivities) permitReasons.push('La operación incluye actividades críticas');
  if (hazardousTasks > 0)
    permitReasons.push('Se reportaron tareas que requieren control operacional');
  if (answers.manualPermits) {
    permitScore += 45;
    permitReasons.push('Los permisos se gestionan manualmente');
  }
  if (permitScore >= 45) modules.push(candidate('WORK_PERMITS', permitScore, permitReasons));

  const riskReasons: string[] = [];
  let riskScore = 0;
  if (answers.fireRisk) {
    riskScore += 55;
    riskReasons.push('Existe exposición declarada a riesgo de incendio');
  }
  if (answers.criticalAssets) {
    riskScore += 30;
    riskReasons.push('La continuidad depende de activos críticos');
  }
  if (answers.chemicals || answers.electricity) {
    riskScore += 20;
    riskReasons.push('Hay fuentes técnicas de riesgo que requieren trazabilidad');
  }
  if (riskScore >= 45) modules.push(candidate('TECHNICAL_RISK', riskScore, riskReasons));

  const peopleReasons: string[] = [];
  let peopleScore = 0;
  if (answers.psychosocialEvaluation) {
    peopleScore += 45;
    peopleReasons.push('La organización necesita evaluar factores psicosociales');
  }
  if (answers.multipleShifts) {
    peopleScore += 20;
    peopleReasons.push('La operación trabaja con múltiples turnos');
  }
  if (answers.drivers || answers.stressExposedRoles) {
    peopleScore += 25;
    peopleReasons.push('Existen cargos con exposición organizacional especial');
  }
  if (answers.organizationalCampaigns) {
    peopleScore += 15;
    peopleReasons.push('Se requiere seguimiento de campañas organizacionales');
  }
  if (peopleScore >= 45) modules.push(candidate('PSYCHOSOCIAL', peopleScore, peopleReasons));

  const complianceReasons: string[] = [];
  let complianceScore = 0;
  if (answers.objectives.includes('COMPLIANCE')) {
    complianceScore += 40;
    complianceReasons.push('El cumplimiento es un objetivo prioritario');
  }
  if (answers.evidenceDifficulty) {
    complianceScore += 35;
    complianceReasons.push('Existe dificultad para encontrar evidencias');
  }
  if (answers.objectives.includes('REPORTING') || answers.objectives.includes('TRACKING')) {
    complianceScore += 25;
    complianceReasons.push('Se necesita mejorar seguimiento y reportería');
  }
  if (complianceScore >= 45)
    modules.push(candidate('COMPLIANCE', complianceScore, complianceReasons));

  modules.sort((a, b) => b.score - a.score);
  return {
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    recommendedModules: modules,
    suggestedPlan: suggestPlan(answers, modules.length),
    suggestedRollout: buildRollout(modules, answers),
    disclaimers: [
      'Esta es una recomendación comercial y no constituye una evaluación técnica de riesgos.',
      'La recomendación no garantiza cumplimiento legal y debe ser revisada por personal autorizado.',
    ],
  };
}
