import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '@sst/api-client';
import {
  assessmentChoiceLabel,
  assessmentErrorMessage,
  assessmentFactLabel,
  assessmentFactValue,
  assessmentTechnicalDetailsPolicy,
  assessmentTopicLabel,
  canSkipAssessmentQuestion,
  explicitBooleanChoices,
  groupAssessmentResults,
  orderAssessmentQuestions,
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

test('claim navigation serializes only session identity and never the public token', () => {
  const path = assessmentClaimPath('assessment-123');
  assert.equal(path, '/app/setup/claim?assessment=assessment-123');
  assert.doesNotMatch(path, /token|secret|bearer/i);
});
