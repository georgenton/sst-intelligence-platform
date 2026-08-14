import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionPrimaryStep,
  activeFilterCount,
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
