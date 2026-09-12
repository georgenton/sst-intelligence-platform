import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKeys } from '../lib/query-keys.ts';
import {
  canMountPrivateApplicationChildren,
  isAssessmentSetupPath,
  requiresAssessmentSetup,
} from '../lib/sst-assessment-setup.ts';

const state = (value, hardGate) => ({ state: value, hardGate, assessmentId: null });

test('new, in-progress and diagnosis-ready organizations are hard gated during PR47', () => {
  for (const value of ['NEEDS_ASSESSMENT', 'ASSESSMENT_IN_PROGRESS', 'DIAGNOSIS_READY']) {
    const setup = state(value, true);
    assert.equal(requiresAssessmentSetup(setup), true);
    assert.equal(canMountPrivateApplicationChildren(setup, '/app/inspections'), false);
    assert.equal(canMountPrivateApplicationChildren(setup, '/app/evaluation'), true);
  }
});

test('legacy configured organizations retain normal application access', () => {
  const setup = state('LEGACY_CONFIGURED', false);
  assert.equal(requiresAssessmentSetup(setup), false);
  assert.equal(canMountPrivateApplicationChildren(setup, '/app/inspections'), true);
});

test('setup paths are finite and organization query identities cannot leak across switches', () => {
  assert.equal(isAssessmentSetupPath('/app/setup/claim'), true);
  assert.equal(isAssessmentSetupPath('/app/organizations'), true);
  assert.equal(isAssessmentSetupPath('/app/evaluation/session-a'), true);
  assert.equal(isAssessmentSetupPath('/app/workers'), false);
  assert.notDeepEqual(
    queryKeys.organization.sstAssessmentSetup('organization-a'),
    queryKeys.organization.sstAssessmentSetup('organization-b'),
  );
  assert.notDeepEqual(
    queryKeys.organization.sstAssessmentSession('organization-a', 'session'),
    queryKeys.organization.sstAssessmentSession('organization-b', 'session'),
  );
});
