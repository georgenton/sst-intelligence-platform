import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionPrimaryLabel,
  actionPrimaryStep,
  actionProgressMeta,
  activeFilterCount,
  alertTypeLabel,
  apiQuery,
  canAcknowledgeInspectionAlerts,
  canCompleteCorrectiveAction,
  canVerifyFindings,
  canWriteInspections,
  filterSearchParams,
  statusMeta,
} from '../lib/inspection-experience.ts';

test('maps status vocabularies independently for inspections, findings and actions', () => {
  assert.equal(statusMeta('inspection', 'COMPLETED').label, 'Completada');
  assert.equal(statusMeta('finding', 'PENDING_VERIFICATION').label, 'Por verificar');
  assert.equal(statusMeta('action', 'PENDING_VERIFICATION').label, 'Pendiente de verificación');
  assert.notEqual(
    statusMeta('finding', 'PENDING_VERIFICATION').label,
    statusMeta('action', 'PENDING_VERIFICATION').label,
  );
});

test('mirrors the inspection write, verification and alert role policies', () => {
  for (const role of ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER', 'SST_TECHNICIAN', 'CONSULTANT']) {
    assert.equal(canWriteInspections(role), true);
  }
  assert.equal(canWriteInspections('VIEWER'), false);
  for (const role of ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']) {
    assert.equal(canVerifyFindings(role), true);
    assert.equal(canAcknowledgeInspectionAlerts(role), true);
  }
  for (const role of ['SST_TECHNICIAN', 'CONSULTANT', 'VIEWER']) {
    assert.equal(canVerifyFindings(role), false);
    assert.equal(canAcknowledgeInspectionAlerts(role), false);
  }
});

test('keeps the technician completion restriction tied to the assigned user', () => {
  assert.equal(
    canCompleteCorrectiveAction({
      role: 'SST_TECHNICIAN',
      userId: 'user-a',
      assignedToUserId: 'user-a',
    }),
    true,
  );
  assert.equal(
    canCompleteCorrectiveAction({
      role: 'SST_TECHNICIAN',
      userId: 'user-a',
      assignedToUserId: 'user-b',
    }),
    false,
  );
  assert.equal(
    canCompleteCorrectiveAction({
      role: 'SST_MANAGER',
      userId: 'user-a',
      assignedToUserId: 'user-b',
    }),
    true,
  );
});

test('builds shareable filters without empty or tenant values', () => {
  const filters = {
    workCenterId: 'center-a',
    inspectionStatus: 'IN_PROGRESS',
    overdue: '',
  };
  assert.equal(filterSearchParams(filters), 'workCenterId=center-a&inspectionStatus=IN_PROGRESS');
  assert.equal(
    apiQuery(filters),
    'workCenterId=center-a&inspectionStatus=IN_PROGRESS&page=1&pageSize=20',
  );
  assert.equal(activeFilterCount(filters), 2);
});

test('presents the corrective action lifecycle without backward transitions', () => {
  assert.equal(actionPrimaryStep('OPEN'), 'start');
  assert.equal(actionPrimaryStep('IN_PROGRESS'), 'complete');
  assert.equal(actionPrimaryStep('PENDING_VERIFICATION'), 'verify');
  assert.equal(actionPrimaryStep('COMPLETED'), null);
  assert.equal(actionPrimaryStep('CANCELED'), null);
});

test('distinguishes pending verification from verified completion in user-facing copy', () => {
  const pending = actionProgressMeta(['PENDING_VERIFICATION']);
  assert.deepEqual(pending, { label: 'Pendiente de verificación', state: 'current' });
  assert.doesNotMatch(pending.label, /complet|cerrad|resuelt|finaliz/iu);
  assert.deepEqual(actionProgressMeta(['COMPLETED']), {
    label: 'Acción verificada',
    state: 'done',
  });
  assert.equal(statusMeta('action', 'COMPLETED').label, 'Verificada');
});

test('labels the in-progress action CTA as a submission to verification', () => {
  assert.equal(actionPrimaryLabel('OPEN'), 'Iniciar acción');
  assert.equal(actionPrimaryLabel('IN_PROGRESS'), 'Enviar a verificación');
  assert.equal(actionPrimaryLabel('PENDING_VERIFICATION'), 'Verificar riesgo residual');
  assert.equal(actionPrimaryLabel('COMPLETED'), null);
});

test('maps every current inspection alert type explicitly and keeps unknown values neutral', () => {
  assert.equal(alertTypeLabel('RECURRENCE'), 'Recurrencia');
  assert.equal(alertTypeLabel('OVERDUE_ACTION'), 'Acción vencida');
  assert.equal(alertTypeLabel('HIGH_RESIDUAL_RISK'), 'Riesgo residual alto o crítico');
  assert.equal(alertTypeLabel('FUTURE_SIGNAL'), 'future signal');
  assert.notEqual(alertTypeLabel('FUTURE_SIGNAL'), 'Riesgo residual alto o crítico');
});
