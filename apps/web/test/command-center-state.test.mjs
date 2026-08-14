import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAsyncCollectionState, resolveAttentionState } from '../lib/command-center-state.ts';

test('loading secondary sources never render the global attention empty state', () => {
  const alerts = resolveAsyncCollectionState({ enabled: true, status: 'pending', itemCount: 0 });
  const technicalRisk = resolveAsyncCollectionState({
    enabled: true,
    status: 'pending',
    itemCount: 0,
  });
  const attention = resolveAttentionState({
    knownAttentionCount: 0,
    sourceStates: [alerts, technicalRisk],
  });

  assert.equal(attention.sourcesLoading, true);
  assert.equal(attention.sourcesSettled, false);
  assert.equal(attention.showEmpty, false);
});

test('a failed alerts source renders partial unavailability instead of global attention empty', () => {
  const alerts = resolveAsyncCollectionState({ enabled: true, status: 'error', itemCount: 0 });
  const technicalRisk = resolveAsyncCollectionState({
    enabled: true,
    status: 'success',
    itemCount: 0,
  });
  const attention = resolveAttentionState({
    knownAttentionCount: 0,
    sourceStates: [alerts, technicalRisk],
  });

  assert.equal(attention.sourcesFailed, true);
  assert.equal(attention.sourcesSettled, false);
  assert.equal(attention.showEmpty, false);
});

test('a failed technical-risk source resolves to error rather than in-progress empty', () => {
  assert.equal(
    resolveAsyncCollectionState({ enabled: true, status: 'error', itemCount: 0 }),
    'error',
  );
});

test('a successful technical-risk response with no drafts resolves to in-progress empty', () => {
  assert.equal(
    resolveAsyncCollectionState({ enabled: true, status: 'success', itemCount: 0 }),
    'success-empty',
  );
});

test('global attention empty requires every enabled source to settle successfully and empty', () => {
  const attention = resolveAttentionState({
    knownAttentionCount: 0,
    sourceStates: [
      resolveAsyncCollectionState({ enabled: true, status: 'success', itemCount: 0 }),
      resolveAsyncCollectionState({ enabled: true, status: 'success', itemCount: 0 }),
    ],
  });

  assert.equal(attention.sourcesSettled, true);
  assert.equal(attention.sourcesLoading, false);
  assert.equal(attention.sourcesFailed, false);
  assert.equal(attention.showEmpty, true);
});

test('known dashboard attention stays visible while a secondary source loads or fails', () => {
  const loading = resolveAttentionState({
    knownAttentionCount: 5,
    sourceStates: ['loading', 'success-empty'],
  });
  const partialError = resolveAttentionState({
    knownAttentionCount: 5,
    sourceStates: ['error', 'success-empty'],
  });

  assert.equal(loading.hasKnownAttention, true);
  assert.equal(loading.sourcesLoading, true);
  assert.equal(loading.showEmpty, false);
  assert.equal(partialError.hasKnownAttention, true);
  assert.equal(partialError.sourcesFailed, true);
  assert.equal(partialError.showEmpty, false);
});

test('disabled module sources do not prevent a truthful attention empty state', () => {
  const attention = resolveAttentionState({
    knownAttentionCount: 0,
    sourceStates: ['disabled', 'success-empty'],
  });

  assert.equal(attention.sourcesSettled, true);
  assert.equal(attention.showEmpty, true);
});
