import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessmentClaimPath,
  clearPublicAssessmentSession,
  loadPublicAssessmentSession,
  rememberAssessmentTargetOrganization,
  storePublicAssessmentSession,
} from '../lib/sst-assessment-session-storage.ts';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('stores only the bounded recovery record and never places its token in navigation', () => {
  const storage = memoryStorage();
  const record = {
    version: 1,
    sessionId: 'assessment-a',
    publicToken: 'private-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.equal(storePublicAssessmentSession(storage, record), true);
  assert.deepEqual(loadPublicAssessmentSession(storage), record);
  assert.equal(assessmentClaimPath(record.sessionId), '/app/setup/claim?assessment=assessment-a');
  assert.doesNotMatch(assessmentClaimPath(record.sessionId), /private-token/);
  assert.equal(
    [...storage.values.keys()].some((key) => key.includes('private-token')),
    false,
  );
});

test('preserves recovery across a target-company failure and clears it after terminal success', () => {
  const storage = memoryStorage();
  storePublicAssessmentSession(storage, {
    version: 1,
    sessionId: 'assessment-b',
    publicToken: 'token-b',
    expiresAt: null,
  });
  assert.equal(
    rememberAssessmentTargetOrganization(storage, 'assessment-b', 'organization-a'),
    true,
  );
  assert.equal(
    loadPublicAssessmentSession(storage, 'assessment-b')?.targetOrganizationId,
    'organization-a',
  );
  clearPublicAssessmentSession(storage, 'assessment-b');
  assert.equal(loadPublicAssessmentSession(storage, 'assessment-b'), null);
});

test('expired and unavailable storage fail safely without becoming setup authority', () => {
  const expired = memoryStorage();
  storePublicAssessmentSession(expired, {
    version: 1,
    sessionId: 'expired',
    publicToken: 'token',
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  assert.equal(loadPublicAssessmentSession(expired), null);
  const unavailable = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(
    storePublicAssessmentSession(unavailable, {
      version: 1,
      sessionId: 'x',
      publicToken: 'y',
      expiresAt: null,
    }),
    false,
  );
  assert.equal(loadPublicAssessmentSession(unavailable), null);
});
