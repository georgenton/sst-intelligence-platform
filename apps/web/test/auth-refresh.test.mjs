import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAuthRefreshSingleFlight,
  createAuthSessionGeneration,
  startLogoutServerInvalidation,
} from '../lib/auth-refresh.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('two concurrent refresh callers share one request and one successful result', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const barrier = deferred();
  const result = { user: { id: 'user-a' }, accessToken: 'access-a' };
  let requestCount = 0;
  const operation = () => {
    requestCount += 1;
    return barrier.promise;
  };

  const first = coordinator.run(operation);
  const second = coordinator.run(operation);
  barrier.resolve(result);

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(requestCount, 1);
  assert.strictEqual(firstResult, result);
  assert.strictEqual(secondResult, result);
});

test('three concurrent refresh callers still issue exactly one request', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const barrier = deferred();
  let requestCount = 0;
  const operation = () => {
    requestCount += 1;
    return barrier.promise;
  };

  const callers = [
    coordinator.run(operation),
    coordinator.run(operation),
    coordinator.run(operation),
  ];
  barrier.resolve({ accessToken: 'shared' });

  const results = await Promise.all(callers);
  assert.equal(requestCount, 1);
  assert.deepEqual(results, [
    { accessToken: 'shared' },
    { accessToken: 'shared' },
    { accessToken: 'shared' },
  ]);
});

test('concurrent callers share one failure without a fallback refresh', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const barrier = deferred();
  const failure = new Error('refresh rejected');
  let requestCount = 0;
  const operation = () => {
    requestCount += 1;
    return barrier.promise;
  };

  const callers = [coordinator.run(operation), coordinator.run(operation)];
  barrier.reject(failure);
  const results = await Promise.allSettled(callers);

  assert.equal(requestCount, 1);
  assert.deepEqual(
    results.map((result) => result.status),
    ['rejected', 'rejected'],
  );
  assert.strictEqual(results[0].reason, failure);
  assert.strictEqual(results[1].reason, failure);
});

test('a later refresh can start after the shared operation settles', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  let requestCount = 0;
  const operation = async () => {
    requestCount += 1;
    return requestCount;
  };

  assert.equal(await coordinator.run(operation), 1);
  assert.equal(await coordinator.run(operation), 2);
  assert.equal(requestCount, 2);
});

test('logout generation prevents a pending refresh from restoring session state', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  let state = { user: { id: 'user-a' }, accessToken: 'access-a', appearanceUser: 'user-a' };
  const refreshGeneration = generation.capture();
  const refresh = coordinator
    .run(() => barrier.promise)
    .then((result) =>
      generation.commit(refreshGeneration, () => {
        state = result;
      }),
    );

  const logoutGeneration = generation.advance();
  generation.commit(logoutGeneration, () => {
    state = { user: null, accessToken: null, appearanceUser: null };
  });
  barrier.resolve({ user: { id: 'user-a' }, accessToken: 'stale', appearanceUser: 'user-a' });
  await refresh;

  assert.deepEqual(state, { user: null, accessToken: null, appearanceUser: null });
});

test('a stale refresh cannot overwrite a newer authenticated generation', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  let state = { user: null, accessToken: null, appearanceUser: null };
  const refreshGeneration = generation.capture();
  const refresh = coordinator
    .run(() => barrier.promise)
    .then((result) =>
      generation.commit(refreshGeneration, () => {
        state = result;
      }),
    );

  const loginGeneration = generation.advance();
  generation.commit(loginGeneration, () => {
    state = { user: { id: 'user-b' }, accessToken: 'access-b', appearanceUser: 'user-b' };
  });
  barrier.resolve({ user: { id: 'user-a' }, accessToken: 'stale', appearanceUser: 'user-a' });
  await refresh;

  assert.deepEqual(state, {
    user: { id: 'user-b' },
    accessToken: 'access-b',
    appearanceUser: 'user-b',
  });
});

test('explicit transitions can wait for the active refresh without starting another request', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const barrier = deferred();
  let requestCount = 0;
  let transitionStarted = false;
  const refresh = coordinator.run(() => {
    requestCount += 1;
    return barrier.promise;
  });
  const transition = coordinator.waitForSettlement().then(() => {
    transitionStarted = true;
  });

  await Promise.resolve();
  assert.equal(transitionStarted, false);
  barrier.resolve({ accessToken: 'access-a' });
  await Promise.all([refresh, transition]);

  assert.equal(requestCount, 1);
  assert.equal(transitionStarted, true);
});

test('logout dispatches its first server invalidation while refresh is still pending', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  let refreshSettled = false;
  let logoutRequestCount = 0;
  const refresh = coordinator
    .run(() => barrier.promise)
    .finally(() => {
      refreshSettled = true;
    });
  const logoutGeneration = generation.advance();

  const firstLogout = startLogoutServerInvalidation({
    capturedRefreshSettlement: coordinator.currentSettlement(),
    isCurrentGeneration: () => generation.isCurrent(logoutGeneration),
    requestLogout: async () => {
      logoutRequestCount += 1;
    },
  });

  assert.equal(logoutRequestCount, 1);
  assert.equal(refreshSettled, false);
  await firstLogout;
  barrier.resolve({ accessToken: 'stale' });
  await refresh;
});

test('logout invalidates a replacement cookie after the captured refresh settles', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  let logoutRequestCount = 0;
  const refresh = coordinator.run(() => barrier.promise);
  const logoutGeneration = generation.advance();
  const capturedRefreshSettlement = coordinator.currentSettlement();

  await startLogoutServerInvalidation({
    capturedRefreshSettlement,
    isCurrentGeneration: () => generation.isCurrent(logoutGeneration),
    requestLogout: async () => {
      logoutRequestCount += 1;
    },
  });
  assert.equal(logoutRequestCount, 1);

  barrier.resolve({ accessToken: 'replacement' });
  await Promise.all([refresh, capturedRefreshSettlement]);
  assert.equal(logoutRequestCount, 2);
});

test('failed captured refresh safely triggers best-effort logout cleanup', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  const failure = new Error('refresh rejected');
  let logoutRequestCount = 0;
  let state = { user: null, accessToken: null };
  const refreshGeneration = generation.capture();
  const refresh = coordinator
    .run(() => barrier.promise)
    .then(
      (result) => generation.commit(refreshGeneration, () => (state = result)),
      () => generation.commit(refreshGeneration, () => (state = { user: null, accessToken: null })),
    );
  const logoutGeneration = generation.advance();
  const capturedRefreshSettlement = coordinator.currentSettlement();

  await startLogoutServerInvalidation({
    capturedRefreshSettlement,
    isCurrentGeneration: () => generation.isCurrent(logoutGeneration),
    requestLogout: async () => {
      logoutRequestCount += 1;
    },
  });
  barrier.reject(failure);
  await Promise.all([refresh, capturedRefreshSettlement]);

  assert.equal(logoutRequestCount, 2);
  assert.deepEqual(state, { user: null, accessToken: null });
  assert.equal(generation.isCurrent(logoutGeneration), true);
});

test('a newer authentication generation prevents stale logout cleanup', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  let logoutRequestCount = 0;
  const refresh = coordinator.run(() => barrier.promise);
  const logoutGeneration = generation.advance();
  const capturedRefreshSettlement = coordinator.currentSettlement();

  await startLogoutServerInvalidation({
    capturedRefreshSettlement,
    isCurrentGeneration: () => generation.isCurrent(logoutGeneration),
    requestLogout: async () => {
      logoutRequestCount += 1;
    },
  });
  const loginGeneration = generation.advance();
  barrier.resolve({ accessToken: 'stale' });
  await Promise.all([refresh, capturedRefreshSettlement]);

  assert.equal(generation.isCurrent(loginGeneration), true);
  assert.equal(logoutRequestCount, 1);
});

test('logout without a pending refresh emits exactly one server request', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const futureRefreshBarrier = deferred();
  let logoutRequestCount = 0;
  const logoutGeneration = generation.advance();
  const capturedRefreshSettlement = coordinator.currentSettlement();

  assert.equal(capturedRefreshSettlement, null);

  await startLogoutServerInvalidation({
    capturedRefreshSettlement,
    isCurrentGeneration: () => generation.isCurrent(logoutGeneration),
    requestLogout: async () => {
      logoutRequestCount += 1;
    },
  });
  const futureRefresh = coordinator.run(() => futureRefreshBarrier.promise);
  futureRefreshBarrier.resolve({ accessToken: 'future' });
  await futureRefresh;

  assert.equal(logoutRequestCount, 1);
});

test('a failed first server logout remains best effort', async () => {
  const failure = new Error('logout unavailable');
  let logoutRequestCount = 0;

  await startLogoutServerInvalidation({
    capturedRefreshSettlement: null,
    isCurrentGeneration: () => true,
    requestLogout: async () => {
      logoutRequestCount += 1;
      throw failure;
    },
  });

  assert.equal(logoutRequestCount, 1);
});

test('a stale refresh rejection cannot clear a newer authenticated generation', async () => {
  const coordinator = createAuthRefreshSingleFlight();
  const generation = createAuthSessionGeneration();
  const barrier = deferred();
  const failure = new Error('refresh rejected');
  let state = { user: null, accessToken: null, appearanceUser: null };
  const refreshGeneration = generation.capture();
  const refresh = coordinator
    .run(() => barrier.promise)
    .catch(() =>
      generation.commit(refreshGeneration, () => {
        state = { user: null, accessToken: null, appearanceUser: null };
      }),
    );

  const loginGeneration = generation.advance();
  generation.commit(loginGeneration, () => {
    state = { user: { id: 'user-b' }, accessToken: 'access-b', appearanceUser: 'user-b' };
  });
  barrier.reject(failure);
  await refresh;

  assert.deepEqual(state, {
    user: { id: 'user-b' },
    accessToken: 'access-b',
    appearanceUser: 'user-b',
  });
});
