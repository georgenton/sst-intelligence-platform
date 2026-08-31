import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearStoredInvitationToken,
  isTerminalInvitationErrorCode,
  isTerminalInvitationStatus,
} from '../lib/invitation-token-lifecycle.ts';

test('classifies only terminal invitation states for secret cleanup', () => {
  for (const status of ['ACCEPTED', 'REVOKED', 'EXPIRED']) {
    assert.equal(isTerminalInvitationStatus(status), true);
  }
  assert.equal(isTerminalInvitationStatus('PENDING'), false);
  assert.equal(isTerminalInvitationStatus(undefined), false);
});

test('classifies terminal server outcomes without clearing recoverable email mismatch', () => {
  for (const code of [
    'INVITATION_ALREADY_USED',
    'INVITATION_EXPIRED',
    'INVITATION_NOT_FOUND',
    'INVITATION_REVOKED',
  ]) {
    assert.equal(isTerminalInvitationErrorCode(code), true);
  }
  assert.equal(isTerminalInvitationErrorCode('INVITATION_EMAIL_MISMATCH'), false);
  assert.equal(isTerminalInvitationErrorCode(undefined), false);
});

test('clears the session-scoped token and tolerates unavailable storage', () => {
  const removed = [];
  assert.equal(
    clearStoredInvitationToken(
      { removeItem: (key) => removed.push(key) },
      'organization-invitation-token:v1',
    ),
    true,
  );
  assert.deepEqual(removed, ['organization-invitation-token:v1']);
  assert.equal(
    clearStoredInvitationToken(
      {
        removeItem: () => {
          throw new Error('storage unavailable');
        },
      },
      'organization-invitation-token:v1',
    ),
    false,
  );
});
