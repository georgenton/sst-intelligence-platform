import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '@sst/api-client';
import { reconcileSstAssessmentConditionalFacts } from '@sst/contracts';
import {
  assessmentChoiceLabel,
  assessmentErrorMessage,
  assessmentFactLabel,
  assessmentFactValue,
  assessmentReconciliationDetails,
  assessmentTechnicalDetailsPolicy,
  assessmentTopicLabel,
  aggregateAssessmentProgress,
  canSkipAssessmentQuestion,
  explicitBooleanChoices,
  groupAssessmentResults,
  orderAssessmentQuestions,
  professionalFoundation,
  resolveAssessmentPresentationScopes,
  resultNextStep,
  resultStateLabel,
  safeResultExplanation,
  visibleFactSummaries,
} from '../lib/sst-assessment-presentation.ts';
import { assessmentClaimPath } from '../lib/sst-assessment-session-storage.ts';

const question = (overrides = {}) => ({
  questionId: 'organization:organization.managementSystem',
  factKey: 'organization.managementSystem',
  scopeKey: 'organization',
  topic: 'Gestión SST',
  valueType: 'SINGLE_CHOICE',
  unknownAllowed: true,
  questionText: '¿Cómo se gestiona hoy la información SST?',
  helpText: 'Ayuda',
  choices: [{ value: 'SPREADSHEETS', label: 'Hojas de cálculo' }],
  purpose: 'Comprender la gestión actual.',
  order: 70,
  sensitivity: 'MEDIUM',
  relatedRuleKeys: [],
  relatedTargetKeys: [],
  collectionPolicy: 'CONTEXT_RECOMMENDED',
  relevancePolicy: 'ALWAYS',
  blocking: false,
  ...overrides,
});

test('resolves claim-time work center labels as an immutable presentation copy', () => {
  const originalScopes = [
    {
      scopeKey: 'organization',
      kind: 'ORGANIZATION',
      order: 0,
      displayName: 'Organización',
    },
    { scopeKey: 'center:1', kind: 'WORK_CENTER', order: 1, displayName: 'Centro 1' },
    { scopeKey: 'center:2', kind: 'WORK_CENTER', order: 2, displayName: 'Centro 2' },
  ];
  const resolved = resolveAssessmentPresentationScopes(originalScopes, [
    {
      scopeKey: 'center:1',
      workCenterId: '00000000-0000-4000-8000-000000000001',
      displayNameAtClaim: 'Planta Norte',
    },
    {
      scopeKey: 'center:2',
      workCenterId: '00000000-0000-4000-8000-000000000002',
      displayNameAtClaim: 'Bodega Sur',
    },
  ]);
  assert.equal(resolved[1].displayName, 'Planta Norte');
  assert.equal(resolved[2].displayName, 'Bodega Sur');
  assert.equal(originalScopes[1].displayName, 'Centro 1');
  assert.notEqual(resolved, originalScopes);
});

test('boolean answers are always explicit and unchecked never means false', () => {
  assert.deepEqual(
    explicitBooleanChoices(true).map(({ value }) => value),
    [true, false, 'EXPLICIT_UNKNOWN'],
  );
  assert.deepEqual(
    explicitBooleanChoices(false).map(({ value }) => value),
    [true, false],
  );
  assert.equal(explicitBooleanChoices(true).find(({ value }) => value === false)?.label, 'No');
});

test('humanizes choices, multi-choice values, unknowns, facts and topics without exposing raw keys', () => {
  assert.equal(assessmentChoiceLabel('workCenter.facilityTypes', 'PLANT'), 'Planta');
  assert.equal(
    assessmentFactValue({
      factKey: 'workCenter.facilityTypes',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: ['PLANT', 'OFFICE'],
      provenance: { source: 'PUBLIC_DECLARATION' },
    }),
    'Planta, Oficina',
  );
  assert.equal(
    assessmentFactValue({
      factKey: 'workCenter.hasCriticalMachinery',
      scopeKey: 'center:1',
      answerState: 'EXPLICIT_UNKNOWN',
      provenance: { source: 'PUBLIC_DECLARATION' },
    }),
    'Aún no lo sabemos',
  );
  assert.equal(assessmentTopicLabel('Perfil organizacional'), 'Empresa');
  assert.doesNotMatch(
    assessmentFactLabel('workCenter.hasCriticalMachinery'),
    /workCenter|hasCritical/,
  );
  const visible = visibleFactSummaries(
    [
      {
        factKey: 'workCenter.hasCriticalMachinery',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: false,
        provenance: { source: 'PUBLIC_DECLARATION' },
      },
    ],
    [{ scopeKey: 'center:1', kind: 'WORK_CENTER', order: 1, displayName: 'Planta Quito' }],
  );
  assert.deepEqual(
    visible.map(({ value }) => value),
    ['No'],
  );
});

test('does not present facility facts after work arrangement changes to remote', () => {
  const facts = reconcileSstAssessmentConditionalFacts({
    schemaVersion: '1.0.0',
    catalogVersion: '1.0.0',
    scopes: [
      { scopeKey: 'organization', kind: 'ORGANIZATION', order: 0, displayName: 'Empresa' },
      { scopeKey: 'center:1', kind: 'WORK_CENTER', order: 1, displayName: 'Centro remoto' },
    ],
    facts: [
      {
        factKey: 'workCenter.workArrangement',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: 'REMOTE',
        provenance: { source: 'PUBLIC_DECLARATION' },
      },
      {
        factKey: 'workCenter.facilityTypes',
        scopeKey: 'center:1',
        answerState: 'KNOWN',
        value: ['PLANT'],
        provenance: { source: 'PUBLIC_DECLARATION' },
      },
    ],
  }).facts;
  const visible = visibleFactSummaries(facts, [
    { scopeKey: 'center:1', kind: 'WORK_CENTER', order: 1, displayName: 'Centro remoto' },
  ]);
  assert.doesNotMatch(JSON.stringify(visible), /Planta|facilityTypes/);
});

test('prioritizes blocking questions before contextual and commercial questions', () => {
  const ordered = orderAssessmentQuestions([
    question({ questionId: 'commercial', collectionPolicy: 'COMMERCIAL_OPTIONAL', order: 1 }),
    question({ questionId: 'context', collectionPolicy: 'CONTEXT_RECOMMENDED', order: 2 }),
    question({
      questionId: 'blocking',
      collectionPolicy: 'FOUNDATION_REQUIRED',
      blocking: true,
      order: 100,
    }),
  ]);
  assert.deepEqual(
    ordered.map(({ questionId }) => questionId),
    ['blocking', 'context', 'commercial'],
  );
  assert.equal(canSkipAssessmentQuestion(ordered[0]), false);
  assert.equal(canSkipAssessmentQuestion(ordered[1]), true);
});

test('uses state-aware and authority-aware result language', () => {
  const missing = {
    scopeKey: 'center:1',
    targetKey: 'DEMO_TARGET',
    title: 'Maquinaria',
    state: 'NEEDS_INFORMATION',
    explanation: 'La maquinaria crítica declarada activa.',
    authority: 'DEMO',
    ruleKeys: [],
    missingFactKeys: ['workCenter.hasCriticalMachinery'],
    professionalReviewRequired: true,
    traces: [],
  };
  assert.match(safeResultExplanation(missing), /Necesitamos completar/);
  assert.doesNotMatch(safeResultExplanation(missing), /declarada activa/);
  assert.doesNotMatch(safeResultExplanation(missing), /workCenter/);
  assert.equal(
    resultStateLabel({ ...missing, state: 'MANDATORY', missingFactKeys: [] }),
    'Prioritario en esta demostración',
  );
  assert.equal(
    resultStateLabel({ ...missing, authority: 'CANDIDATE' }),
    'Criterio regulatorio en revisión',
  );
  assert.doesNotMatch(
    resultStateLabel({ ...missing, authority: 'CANDIDATE' }),
    /Obligatorio|incumpl/i,
  );
  assert.equal(
    groupAssessmentResults([
      missing,
      { ...missing, targetKey: 'candidate', authority: 'CANDIDATE' },
    ]).length,
    2,
  );
});

test('keeps technical trace restricted and error codes translated', () => {
  assert.deepEqual(assessmentTechnicalDetailsPolicy('PUBLIC'), {
    available: false,
    defaultOpen: false,
  });
  assert.deepEqual(assessmentTechnicalDetailsPolicy('AUTHENTICATED'), {
    available: true,
    defaultOpen: false,
  });
  const error = new ApiClientError(409, {
    code: 'SST_ASSESSMENT_REVISION_CONFLICT',
    message: 'raw',
    details: null,
    traceId: 'trace',
  });
  assert.match(assessmentErrorMessage(error), /otra pestaña/);
  assert.doesNotMatch(assessmentErrorMessage(error), /REVISION_CONFLICT/);
  const reconciliation = new ApiClientError(409, {
    code: 'SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED',
    message: 'raw topology error',
    details: null,
    traceId: 'trace',
  });
  assert.match(assessmentErrorMessage(reconciliation), /país o los centros/);
  assert.doesNotMatch(assessmentErrorMessage(reconciliation), /raw topology error/);
  const unknown = new ApiClientError(409, {
    code: 'UNEXPECTED_INTERNAL_CODE',
    message: 'secret raw detail',
    details: null,
    traceId: 'trace',
  });
  assert.doesNotMatch(
    assessmentErrorMessage(unknown),
    /secret raw detail|UNEXPECTED_INTERNAL_CODE/,
  );
});

test('presents only bounded human reconciliation categories', () => {
  const profile = assessmentReconciliationDetails(
    new ApiClientError(409, {
      code: 'SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED',
      message: 'raw',
      details: {
        conflictCategories: [
          'ORGANIZATION_WORKER_COUNT',
          'ORGANIZATION_SECTOR',
          'CHEMICAL_PROCESS_PRESENT',
          'HIGH_ENERGY_OPERATION_PRESENT',
          'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
          'INTERNAL_FUTURE_ENUM',
        ],
      },
      traceId: 'trace',
    }),
  );
  assert.deepEqual(profile?.categories, [
    'Número total de personas trabajadoras',
    'Actividad principal',
    'Procesos con sustancias químicas',
    'Operaciones con fuentes de alta energía',
    'Personal externo o contratistas',
    'Otra diferencia de contexto',
  ]);
  assert.doesNotMatch(JSON.stringify(profile), /INTERNAL_FUTURE_ENUM/);
  assert.deepEqual(
    assessmentReconciliationDetails(
      new ApiClientError(409, {
        code: 'SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED',
        message: 'raw',
        details: { reason: 'COUNTRY' },
        traceId: 'trace',
      }),
    )?.categories,
    ['País de la empresa'],
  );
});

test('claim navigation serializes only session identity and never the public token', () => {
  const path = assessmentClaimPath('assessment-123');
  assert.equal(path, '/app/setup/claim?assessment=assessment-123');
  assert.doesNotMatch(path, /token|secret|bearer/i);
});

test('aggregates raw progress into the same human groups rendered by the UI', () => {
  const progress = {
    answeredFacts: 3,
    resolvedFactCount: 3,
    explicitUnknownCount: 0,
    pendingQuestionCount: 1,
    totalFacts: 4,
    completedTopics: 2,
    totalTopics: 3,
    topics: [
      { topic: 'Exposiciones operativas', answered: 1, total: 1, complete: true },
      { topic: 'Trabajos críticos', answered: 1, total: 2, complete: false },
      { topic: 'Gestión SST', answered: 1, total: 1, complete: true },
    ],
  };
  const partial = aggregateAssessmentProgress(progress, 'Trabajos críticos');
  assert.equal(partial.totalTopics, partial.topics.length);
  assert.equal(partial.totalTopics, 2);
  assert.equal(partial.completedTopics, 1);
  assert.deepEqual(partial.topics[0], {
    label: 'Operación',
    answered: 2,
    total: 3,
    complete: false,
    active: true,
  });

  const complete = aggregateAssessmentProgress({
    ...progress,
    topics: progress.topics.map((topic) => ({ ...topic, complete: true })),
  });
  assert.equal(complete.completedTopics, 2);
  assert.equal(complete.topics[0].complete, true);
});

test('orders human progress topics canonically regardless of backend insertion order', () => {
  const topics = [
    { topic: 'Contexto adicional', answered: 1, total: 1, complete: true },
    { topic: 'Personas y operación', answered: 1, total: 1, complete: true },
    { topic: 'Gestión SST', answered: 1, total: 1, complete: true },
    { topic: 'Centro de trabajo', answered: 1, total: 1, complete: true },
    { topic: 'Perfil organizacional', answered: 1, total: 1, complete: true },
    { topic: 'Prioridades', answered: 1, total: 1, complete: true },
    { topic: 'Trabajos críticos', answered: 1, total: 1, complete: true },
  ];
  const progress = aggregateAssessmentProgress({
    answeredFacts: topics.length,
    resolvedFactCount: topics.length,
    explicitUnknownCount: 0,
    pendingQuestionCount: 0,
    totalFacts: topics.length,
    completedTopics: topics.length,
    totalTopics: topics.length,
    topics,
  });
  assert.deepEqual(
    progress.topics.map(({ label }) => label),
    ['Empresa', 'Centros', 'Operación', 'Gestión', 'Personas', 'Prioridades', 'Implementación'],
  );
});

test('builds a human professional foundation without raw DSL or invented legal sources', () => {
  const item = {
    scopeKey: 'center:1',
    targetKey: 'DEMO_TARGET',
    title: 'Trabajo crítico',
    state: 'RECOMMENDED',
    explanation: 'Conviene revisar las condiciones declaradas.',
    authority: 'DEMO',
    ruleKeys: ['DEMO_RULE_123'],
    missingFactKeys: [],
    professionalReviewRequired: false,
    traces: [
      {
        groupKey: 'DEMO_GROUP',
        ruleKey: 'DEMO_RULE_123',
        ruleVersion: '1.0.0',
        scopeKey: 'center:1',
        result: 'TRUE',
        targetKey: 'DEMO_TARGET',
        state: 'RECOMMENDED',
        minimumDepth: 'ORIENTATIVE',
        predicates: [
          {
            factKey: 'workCenter.hasWorkAtHeight',
            factScope: 'CURRENT_SCOPE',
            operator: 'BOOLEAN_IS',
            expected: true,
            actual: true,
            result: 'TRUE',
          },
          {
            factKey: 'workCenter.facilityTypes',
            factScope: 'CURRENT_SCOPE',
            operator: 'ARRAY_OVERLAPS',
            expected: ['PLANT'],
            actual: ['PLANT', 'OFFICE'],
            result: 'TRUE',
          },
        ],
      },
    ],
  };
  const foundation = professionalFoundation(item, [
    { scopeKey: 'center:1', kind: 'WORK_CENTER', order: 1, displayName: 'Planta Norte' },
  ]);
  assert.equal(foundation.scope, 'Planta Norte');
  assert.deepEqual(
    foundation.dataUsed.map(({ value }) => value),
    ['Sí', 'Planta, Oficina'],
  );
  const rendered = JSON.stringify(foundation);
  assert.doesNotMatch(rendered, /workCenter|BOOLEAN_IS|ARRAY_OVERLAPS|DEMO_RULE_123/);
  assert.doesNotMatch(rendered, /ISO|artículo|norma/i);
  assert.equal(
    resultNextStep(item),
    'Puedes incorporar esta recomendación en la siguiente etapa de configuración.',
  );
  assert.equal(
    resultNextStep({ ...item, state: 'NEEDS_INFORMATION' }),
    'Completa la información pendiente para resolver este criterio.',
  );
  assert.equal(
    resultNextStep({ ...item, professionalReviewRequired: true }),
    'Requiere revisión profesional antes de cerrar la decisión.',
  );
});
