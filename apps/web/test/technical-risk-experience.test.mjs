import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_TECHNICAL_RISK_METHOD } from '@sst/contracts';
import {
  canReviewTechnicalRisk,
  canWriteTechnicalRisk,
  isTechnicalAnswerValid,
  latestTechnicalReview,
  methodSnapshotProvenance,
  technicalAssessmentStatusMeta,
  technicalMutationError,
  technicalQuestionControl,
  technicalReviewState,
} from '../lib/technical-risk-experience.ts';

test('mirrors the backend write and professional-review role matrix', () => {
  for (const role of ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER', 'SST_TECHNICIAN', 'CONSULTANT']) {
    assert.equal(canWriteTechnicalRisk(role), true);
  }
  assert.equal(canWriteTechnicalRisk('VIEWER'), false);
  for (const role of ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']) {
    assert.equal(canReviewTechnicalRisk(role), true);
  }
  for (const role of ['SST_TECHNICIAN', 'CONSULTANT', 'VIEWER']) {
    assert.equal(canReviewTechnicalRisk(role), false);
  }
});

test('keeps NEEDS_REVISION completed and presents APPROVED as reviewed', () => {
  const revision = [{ decision: 'NEEDS_REVISION', createdAt: '2026-08-14T12:00:00Z' }];
  const approved = [{ decision: 'APPROVED', createdAt: '2026-08-14T12:00:00Z' }];
  assert.equal(technicalReviewState('COMPLETED', revision).label, 'Revisión: requiere ajustes');
  assert.match(technicalReviewState('COMPLETED', revision).description, /permanece completada/);
  assert.equal(technicalReviewState('REVIEWED', approved).label, 'Revisión aprobada');
  assert.equal(technicalAssessmentStatusMeta('COMPLETED').label, 'Completada');
  assert.equal(technicalAssessmentStatusMeta('REVIEWED').label, 'Revisada');
  assert.deepEqual(latestTechnicalReview([...revision, ...approved]), approved[0]);
});

test('maps every current typed question to one narrowly scoped native control', () => {
  const questions = [
    { key: 'boolean', label: 'Boolean', required: true, type: 'BOOLEAN' },
    {
      key: 'choice',
      label: 'Choice',
      required: true,
      type: 'SINGLE_CHOICE',
      options: [{ value: 'a', label: 'A' }],
    },
    { key: 'integer', label: 'Integer', required: true, type: 'INTEGER' },
    { key: 'decimal', label: 'Decimal', required: true, type: 'DECIMAL' },
    { key: 'text', label: 'Text', required: true, type: 'TEXT', maxLength: 20 },
    { key: 'likelihood', label: 'Likelihood', required: true, type: 'LIKELIHOOD', min: 1, max: 5 },
    {
      key: 'consequence',
      label: 'Consequence',
      required: true,
      type: 'CONSEQUENCE',
      min: 1,
      max: 5,
    },
  ];
  assert.deepEqual(
    questions.map((question) => technicalQuestionControl(question)),
    [
      'boolean-radio',
      'select',
      'integer-input',
      'decimal-input',
      'textarea',
      'likelihood-radio',
      'consequence-radio',
    ],
  );
  assert.deepEqual(
    questions.map((question, index) =>
      isTechnicalAnswerValid(question, [true, 'a', 3, 3.5, 'texto', 4, 5][index]),
    ),
    [true, true, true, true, true, true, true],
  );
  assert.deepEqual(
    questions.map((question, index) =>
      isTechnicalAnswerValid(question, ['sí', 'b', 3.5, Number.NaN, 'x'.repeat(21), 0, 6][index]),
    ),
    [false, false, false, false, false, false, false],
  );
});

test('uses the stored assessment snapshot and never the current method catalog for provenance', () => {
  const provenance = methodSnapshotProvenance({
    methodVersion: '1.0.0',
    methodSnapshot: {
      methodName: DEMO_TECHNICAL_RISK_METHOD.methodName,
      isDemo: true,
      disclaimer: DEMO_TECHNICAL_RISK_METHOD.disclaimer,
    },
  });
  assert.deepEqual(provenance, {
    name: 'Evaluación técnica demostrativa',
    version: '1.0.0',
    isDemo: true,
    disclaimer: 'Metodología demostrativa. No constituye una evaluación regulatoria validada.',
  });
});

test('normalizes stale, permission and recoverable request failures without raw server copy', () => {
  assert.equal(technicalMutationError({ status: 409 }).kind, 'stale');
  assert.match(technicalMutationError({ status: 409 }).message, /estado vigente/);
  assert.equal(technicalMutationError({ status: 403 }).kind, 'permission');
  assert.equal(technicalMutationError(new Error('raw backend')).kind, 'request');
  assert.doesNotMatch(technicalMutationError(new Error('raw backend')).message, /raw backend/);
});
