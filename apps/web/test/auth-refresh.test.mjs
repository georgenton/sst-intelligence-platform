import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { ApiClientError } from '@sst/api-client';
import {
  AuthSessionExpiredError,
  createAuthenticatedRequestCoordinator,
} from '../lib/authenticated-request.ts';
import {
  createAuthRefreshSingleFlight,
  createAuthSessionGeneration,
  startLogoutServerInvalidation,
} from '../lib/auth-refresh.ts';

function jwtExpiringAt(timestampMs) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(timestampMs / 1000) })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}

function responseError(status) {
  return new ApiClientError(status, {
    code: `HTTP_${status}`,
    message: 'controlled failure',
    details: null,
    traceId: 'test-trace',
  });
}

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

test('valid access token sends one private request without refresh', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now + 120_000), generation: 0 };
  let refreshCount = 0;
  let requestCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      refreshCount += 1;
      return { accessToken: 'unexpected' };
    },
    invalidate: () => undefined,
    transport: async (_path, _init, context) => {
      requestCount += 1;
      assert.equal(context.accessToken, state.accessToken);
      return { ok: true };
    },
  });

  assert.deepEqual(await request('/dashboard'), { ok: true });
  assert.equal(refreshCount, 0);
  assert.equal(requestCount, 1);
});

test('near-expiry access token proactively refreshes before the private request', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now + 30_000), generation: 0 };
  let refreshCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      refreshCount += 1;
      state.accessToken = jwtExpiringAt(now + 900_000);
      return { accessToken: state.accessToken };
    },
    invalidate: () => undefined,
    transport: async (_path, _init, context) => {
      assert.equal(context.accessToken, state.accessToken);
      return { ok: true };
    },
  });

  assert.deepEqual(await request('/applicability/profile-versions'), { ok: true });
  assert.equal(refreshCount, 1);
});

test('expired access token refreshes and preserves organization context', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now - 1_000), generation: 0 };
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      state.accessToken = jwtExpiringAt(now + 900_000);
      return { accessToken: state.accessToken };
    },
    invalidate: () => undefined,
    transport: async (_path, _init, context) => {
      assert.equal(context.organizationId, 'organization-a');
      return { ok: true };
    },
  });

  assert.deepEqual(await request('/dashboard', {}, 'organization-a'), { ok: true });
});

test('first 401 refreshes once and retries the JSON request exactly once', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now + 900_000), generation: 0 };
  let refreshCount = 0;
  let requestCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      refreshCount += 1;
      state.accessToken = 'refreshed-access';
      return { accessToken: state.accessToken };
    },
    invalidate: () => undefined,
    transport: async (_path, init, context) => {
      requestCount += 1;
      assert.equal(init.body, '{"answer":true}');
      if (requestCount === 1) throw responseError(401);
      assert.equal(context.accessToken, 'refreshed-access');
      return { ok: true };
    },
  });

  assert.deepEqual(
    await request('/adaptive-configuration/sessions', {
      method: 'POST',
      body: '{"answer":true}',
    }),
    { ok: true },
  );
  assert.equal(refreshCount, 1);
  assert.equal(requestCount, 2);
});

test('ten concurrent expired-token requests share one rotating refresh', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now - 1_000), generation: 0 };
  const refreshFlight = createAuthRefreshSingleFlight();
  const barrier = deferred();
  let refreshCount = 0;
  let requestCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: () =>
      refreshFlight.run(async () => {
        refreshCount += 1;
        const result = await barrier.promise;
        state.accessToken = result.accessToken;
        return result;
      }),
    invalidate: () => undefined,
    transport: async (_path, _init, context) => {
      requestCount += 1;
      assert.equal(context.accessToken, 'shared-refreshed-access');
      return { ok: true };
    },
  });

  const callers = Array.from({ length: 10 }, () => request('/organizations'));
  await Promise.resolve();
  barrier.resolve({ accessToken: 'shared-refreshed-access' });
  const results = await Promise.all(callers);

  assert.equal(refreshCount, 1);
  assert.equal(requestCount, 10);
  assert.deepEqual(
    results,
    Array.from({ length: 10 }, () => ({ ok: true })),
  );
});

test('refresh failure invalidates the current session once for concurrent callers', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now - 1_000), generation: 0 };
  const refreshFlight = createAuthRefreshSingleFlight();
  let invalidationCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: () => refreshFlight.run(async () => Promise.reject(new Error('refresh failed'))),
    invalidate: (generation) => {
      if (generation !== state.generation) return;
      invalidationCount += 1;
      state.generation += 1;
      state.accessToken = null;
    },
    transport: async () => ({ ok: true }),
  });

  const results = await Promise.allSettled([
    request('/dashboard'),
    request('/organizations'),
    request('/module-catalog'),
  ]);

  assert.equal(invalidationCount, 1);
  assert.deepEqual(
    results.map((result) => result.status),
    ['rejected', 'rejected', 'rejected'],
  );
  assert.ok(results.some((result) => result.reason instanceof AuthSessionExpiredError));
});

test('a second 401 invalidates the session without another refresh loop', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now + 900_000), generation: 0 };
  let refreshCount = 0;
  let requestCount = 0;
  let invalidationCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      refreshCount += 1;
      state.accessToken = 'refreshed';
      return { accessToken: state.accessToken };
    },
    invalidate: () => {
      invalidationCount += 1;
      state.generation += 1;
      state.accessToken = null;
    },
    transport: async () => {
      requestCount += 1;
      throw responseError(401);
    },
  });

  await assert.rejects(() => request('/dashboard'), AuthSessionExpiredError);
  assert.equal(refreshCount, 1);
  assert.equal(requestCount, 2);
  assert.equal(invalidationCount, 1);
});

test('403 remains an authorization failure and never triggers refresh', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now + 900_000), generation: 0 };
  let refreshCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      refreshCount += 1;
      return { accessToken: 'unexpected' };
    },
    invalidate: () => undefined,
    transport: async () => {
      throw responseError(403);
    },
  });

  await assert.rejects(
    () => request('/dashboard'),
    (error) => error.status === 403,
  );
  assert.equal(refreshCount, 0);
});

test('abort while waiting for refresh prevents the feature request and preserves session', async () => {
  const now = 1_800_000_000_000;
  const state = { accessToken: jwtExpiringAt(now - 1_000), generation: 0 };
  const barrier = deferred();
  const controller = new globalThis.AbortController();
  let invalidationCount = 0;
  let requestCount = 0;
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    now: () => now,
    refresh: async () => {
      const result = await barrier.promise;
      state.accessToken = result.accessToken;
      return result;
    },
    invalidate: () => {
      invalidationCount += 1;
    },
    transport: async () => {
      requestCount += 1;
      return { ok: true };
    },
  });

  const pending = request('/dashboard', { signal: controller.signal });
  controller.abort();
  await assert.rejects(
    () => pending,
    (error) => error.name === 'AbortError',
  );
  barrier.resolve({ accessToken: 'rotated-after-abort' });
  await Promise.resolve();

  assert.equal(requestCount, 0);
  assert.equal(invalidationCount, 0);
});

test('auth endpoints cannot recurse through the private coordinator', async () => {
  const state = { accessToken: 'access', generation: 0 };
  const request = createAuthenticatedRequestCoordinator({
    getSession: () => state,
    refresh: async () => ({ accessToken: 'refreshed' }),
    invalidate: () => undefined,
    transport: async () => ({ ok: true }),
  });

  for (const path of ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']) {
    await assert.rejects(() => request(path), /AUTH_ENDPOINT_COORDINATOR_BYPASS_REQUIRED/);
  }
});
