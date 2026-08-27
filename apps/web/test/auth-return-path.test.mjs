import assert from 'node:assert/strict';
import test from 'node:test';
import { safeAuthReturnPath } from '../lib/auth-return-path.ts';

test('keeps only authenticated application and exact invitation return paths', () => {
  assert.equal(safeAuthReturnPath('/app'), '/app');
  assert.equal(
    safeAuthReturnPath('/app/work-permits?status=DRAFT'),
    '/app/work-permits?status=DRAFT',
  );
  assert.equal(safeAuthReturnPath('/invite/accept'), '/invite/accept');
});

test('rejects external, protocol-relative and unrelated return paths', () => {
  for (const value of [
    null,
    '',
    '//attacker.example/path',
    'https://attacker.example/path',
    '/invite/accept/other',
    '/application',
    '/diagnostico',
  ]) {
    assert.equal(safeAuthReturnPath(value), '/app');
  }
});
