import {
  type SstAssessmentFact,
  type SstAssessmentQuestion,
  type SstAssessmentResult,
  type SstAssessmentScope,
} from '@sst/contracts';
import { SST_ASSESSMENT_FACT_CATALOG } from '@sst/contracts/sst-assessment-catalog';
import { ApiClientError } from '@sst/api-client';

const definitions = new Map(SST_ASSESSMENT_FACT_CATALOG.map((item) => [item.factKey, item]));

const topicLabels: Record<string, string> = {
  'Perfil organizacional': 'Empresa',
  'Centros de trabajo': 'Centros',
  'Centro de trabajo': 'Centros',
  'Exposiciones operativas': 'Operación',
  'Trabajos críticos': 'Operación',
  Contratistas: 'Operación',
  Maquinaria: 'Operación',
  Transporte: 'Operación',
  Emergencias: 'Operación',
  'Gestión SST': 'Gestión',
  Inspecciones: 'Gestión',
  'Permisos de trabajo': 'Gestión',
  Evidencia: 'Gestión',
  Seguimiento: 'Gestión',
  Planificación: 'Gestión',
  'Personas y operación': 'Personas',
  'Contexto preventivo': 'Personas',
  Prioridades: 'Prioridades',
  Objetivos: 'Prioridades',
  Implementación: 'Implementación',
  'Contexto adicional': 'Implementación',
};

const policyPriority: Record<SstAssessmentQuestion['collectionPolicy'], number> = {
  FOUNDATION_REQUIRED: 0,
  CONDITIONAL: 1,
  SPECIALIST_REQUIRED: 2,
  CONTEXT_RECOMMENDED: 3,
  COMMERCIAL_OPTIONAL: 4,
};

export function explicitBooleanChoices(unknownAllowed: boolean) {
  return [
    { label: 'Sí', value: true as const },
    { label: 'No', value: false as const },
    ...(unknownAllowed ? [{ label: 'No lo sé', value: 'EXPLICIT_UNKNOWN' as const }] : []),
  ];
}

export function canSkipAssessmentQuestion(question: SstAssessmentQuestion) {
  return !question.blocking;
}

export function assessmentTechnicalDetailsPolicy(channel: 'PUBLIC' | 'AUTHENTICATED') {
  return { available: channel === 'AUTHENTICATED', defaultOpen: false };
}

export function orderAssessmentQuestions(questions: readonly SstAssessmentQuestion[]) {
  return [...questions].sort(
    (left, right) =>
      Number(right.blocking) - Number(left.blocking) ||
      policyPriority[left.collectionPolicy] - policyPriority[right.collectionPolicy] ||
      left.order - right.order ||
      left.scopeKey.localeCompare(right.scopeKey),
  );
}

export function assessmentTopicLabel(topic: string) {
  return topicLabels[topic] ?? 'Información';
}

export function assessmentFactLabel(factKey: string) {
  const definition = definitions.get(factKey);
  return definition?.questionText.replace(/^¿|\?$/g, '') ?? 'Información pendiente';
}

export function assessmentChoiceLabel(factKey: string, value: string) {
  return definitions.get(factKey)?.choices.find((choice) => choice.value === value)?.label ?? value;
}

export function assessmentFactValue(fact: SstAssessmentFact) {
  if (fact.answerState === 'EXPLICIT_UNKNOWN') return 'Aún no lo sabemos';
  if (typeof fact.value === 'boolean') return fact.value ? 'Sí' : 'No';
  if (Array.isArray(fact.value))
    return fact.value.map((value) => assessmentChoiceLabel(fact.factKey, value)).join(', ');
  if (typeof fact.value === 'string')
    return assessmentChoiceLabel(fact.factKey, fact.value) || fact.value;
  return new Intl.NumberFormat('es-EC').format(fact.value);
}

export function visibleFactSummaries(
  facts: readonly SstAssessmentFact[],
  scopes: readonly SstAssessmentScope[],
) {
  const scopeNames = new Map(scopes.map((scope) => [scope.scopeKey, scope.displayName]));
  return facts
    .filter(({ factKey }) => factKey !== 'organization.workCenterCount')
    .map((fact) => ({
      identity: `${fact.scopeKey}:${fact.factKey}`,
      scopeKey: fact.scopeKey,
      scopeName: scopeNames.get(fact.scopeKey) ?? 'Empresa',
      factKey: fact.factKey,
      label: assessmentFactLabel(fact.factKey),
      value: assessmentFactValue(fact),
    }));
}

export function editableQuestionForFact(
  fact: SstAssessmentFact,
  scope: SstAssessmentScope,
): SstAssessmentQuestion | null {
  const definition = definitions.get(fact.factKey);
  if (
    !definition ||
    definition.authenticatedDerived ||
    fact.factKey === 'organization.workCenterCount'
  )
    return null;
  return {
    questionId: `${scope.scopeKey}:${definition.factKey}`,
    factKey: definition.factKey,
    scopeKey: scope.scopeKey,
    topic: definition.topic,
    valueType: definition.valueType,
    unknownAllowed: definition.unknownAllowed,
    questionText: definition.questionText,
    helpText: definition.helpText,
    choices: definition.choices,
    purpose: definition.purpose,
    order: definition.order,
    sensitivity: definition.sensitivity,
    relatedRuleKeys: [],
    relatedTargetKeys: [],
    collectionPolicy: definition.collectionPolicy,
    relevancePolicy: definition.relevancePolicy,
    blocking: definition.blocksReadiness,
  };
}

export function questionBounds(factKey: string) {
  const definition = definitions.get(factKey);
  return { min: definition?.min, max: definition?.max, maxLength: definition?.maxLength };
}

export function assessmentErrorMessage(error: unknown) {
  if (!(error instanceof ApiClientError))
    return 'No pudimos guardar esta respuesta. Intenta nuevamente.';
  if (error.payload.code === 'SST_ASSESSMENT_REVISION_CONFLICT')
    return 'Esta evaluación cambió en otra pestaña. Actualizamos la información más reciente.';
  if (error.payload.code === 'SST_ASSESSMENT_CONTEXT_CHANGED')
    return 'La información registrada de tu empresa cambió. Necesitamos actualizar esta evaluación antes de continuar.';
  if (error.payload.code === 'SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED')
    return 'La empresa elegida no coincide con el país o los centros de esta evaluación. Revisa la correspondencia antes de continuar.';
  if (error.payload.code === 'SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED')
    return 'Encontramos diferencias entre este diagnóstico y la información actual de tu empresa.';
  if (error.payload.code === 'SST_ASSESSMENT_TOKEN_INVALID')
    return 'Esta evaluación ya no está disponible. Inicia una nueva.';
  return 'No pudimos continuar con la evaluación. Revisa la información e intenta nuevamente.';
}

export type ResultGroup = { key: string; title: string; items: SstAssessmentResult['items'] };

export function groupAssessmentResults(items: SstAssessmentResult['items']): ResultGroup[] {
  const groups: ResultGroup[] = [
    { key: 'review', title: 'Requiere revisión profesional', items: [] },
    { key: 'information', title: 'Necesita más información', items: [] },
    { key: 'recommendations', title: 'Recomendaciones identificadas', items: [] },
    { key: 'candidate', title: 'Criterios regulatorios en revisión', items: [] },
  ];
  for (const item of items) {
    if (item.authority === 'CANDIDATE') groups[3]!.items.push(item);
    else if (item.state === 'NEEDS_INFORMATION') groups[1]!.items.push(item);
    else if (item.professionalReviewRequired) groups[0]!.items.push(item);
    else groups[2]!.items.push(item);
  }
  return groups.filter(({ items: grouped }) => grouped.length > 0);
}

export function resultStateLabel(item: SstAssessmentResult['items'][number]) {
  if (item.authority === 'CANDIDATE') return 'Criterio regulatorio en revisión';
  if (item.state === 'NEEDS_INFORMATION') return 'Necesita más información';
  if (item.authority === 'DEMO' && item.state === 'MANDATORY')
    return 'Prioritario en esta demostración';
  if (item.professionalReviewRequired) return 'Requiere revisión profesional';
  return 'Recomendación identificada';
}

export function safeResultExplanation(item: SstAssessmentResult['items'][number]) {
  if (item.state === 'NEEDS_INFORMATION' && item.missingFactKeys.length > 0) {
    const labels = item.missingFactKeys.map(assessmentFactLabel).join('; ');
    return `Necesitamos completar esta información para determinar si la revisión aplica: ${labels}.`;
  }
  return item.explanation;
}
