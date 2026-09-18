import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCreateAssessmentPlan,
  planHandoffRetryKey,
  planHandoffStorageKey,
  planItemSource,
  operationalPlanError,
} from '../lib/operational-plan-handoff.ts';
import { canMountPrivateApplicationChildren } from '../lib/sst-assessment-setup.ts';
import { queryKeys } from '../lib/query-keys.ts';
const evaluation = { recommendations: [{ capabilityKey: 'INSPECTIONS' }] };
for (const [channel, status, source, allowed] of [
  ['AUTHENTICATED', 'FINALIZED', evaluation, true],
  ['PUBLIC', 'FINALIZED', evaluation, false],
  ['AUTHENTICATED', 'DIAGNOSIS_READY', evaluation, false],
  ['AUTHENTICATED', 'COLLECTING_INFORMATION', evaluation, false],
  ['AUTHENTICATED', 'FINALIZED', null, false],
  ['AUTHENTICATED', 'FINALIZED', { recommendations: [] }, false],
]) {
  test(`handoff eligibility ${channel}/${status}/${Boolean(source)} requires finalized stored recommendations`, () =>
    assert.equal(canCreateAssessmentPlan(channel, status, source), allowed));
}
test('retry key survives lost response, remount and retries until successful cleanup', () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  const scope = planHandoffStorageKey('owner', 'org', 'assessment');
  const key = '10000000-0000-4000-8000-000000000001';
  let generated = 0;
  const create = () => {
    generated++;
    return key;
  };
  assert.equal(planHandoffRetryKey(storage, scope, create), key);
  assert.equal(planHandoffRetryKey(storage, scope, create), key);
  assert.equal(generated, 1);
  storage.removeItem(scope);
  planHandoffRetryKey(storage, scope, create);
  assert.equal(generated, 2);
  assert.notEqual(scope, planHandoffStorageKey('other', 'org', 'assessment'));
  assert.notEqual(scope, planHandoffStorageKey('owner', 'other', 'assessment'));
});
test('source labels and bounded errors expose no hashes, enums or internal errors', () => {
  assert.equal(
    planItemSource('UNIFIED_SST_EVALUATION', { assessmentSessionId: 'assessment' }),
    'Diagnóstico SST',
  );
  assert.doesNotMatch(operationalPlanError(), /Prisma|sha256|password|token/);
});
test('only a finalized diagnosis unlocks the plan handoff during setup', () => {
  const state = { state: 'DIAGNOSIS_READY', hardGate: true, assessmentId: 'assessment' };
  assert.equal(canMountPrivateApplicationChildren(state, '/app/plans/new'), false);
  assert.equal(
    canMountPrivateApplicationChildren({ ...state, finalizedAt: '2026-09-17' }, '/app/plans/new'),
    true,
  );
  assert.equal(
    canMountPrivateApplicationChildren({ ...state, finalizedAt: '2026-09-17' }, '/app/inspections'),
    false,
  );
  assert.equal(
    canMountPrivateApplicationChildren(
      { ...state, finalizedAt: '2026-09-17' },
      '/app/plans-unrelated',
    ),
    false,
  );
});
test('plan context cache belongs to the active organization', () =>
  assert.notDeepEqual(
    queryKeys.organization.operationalPlanContext('a'),
    queryKeys.organization.operationalPlanContext('b'),
  ));
