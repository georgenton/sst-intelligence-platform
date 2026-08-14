import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
  activeOrganizationStorageKey,
  clearStoredActiveOrganization,
  resolveStoredActiveOrganization,
  storeActiveOrganization,
} from '../lib/active-organization-storage.ts';
import {
  isolateOrganizationTransition,
  planOrganizationReconciliation,
  removeAllPrivateQueries,
} from '../lib/query-cache.ts';
import { isPrivateQueryKey, queryKeys } from '../lib/query-keys.ts';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
}

test('query factories distinguish public, global, user and organization ownership', () => {
  assert.deepEqual(queryKeys.public.solutionFinder.result('session-a'), [
    'public',
    'solution-finder',
    'result',
    'session-a',
  ]);
  assert.deepEqual(queryKeys.global.moduleCatalog(), ['global', 'module-catalog']);
  assert.deepEqual(queryKeys.user.organizations('user-a'), [
    'private',
    'user',
    'user-a',
    'organizations',
  ]);
  assert.deepEqual(queryKeys.organization.dashboard('org-a'), [
    'private',
    'org',
    'org-a',
    'dashboard',
  ]);
  assert.deepEqual(queryKeys.organization.inspectionList('org-a', 'page=1&pageSize=20'), [
    'private',
    'org',
    'org-a',
    'inspections',
    'list',
    'page=1&pageSize=20',
  ]);
  assert.deepEqual(queryKeys.organization.inspectionAlertList('org-a', 'status=OPEN'), [
    'private',
    'org',
    'org-a',
    'inspections',
    'alerts',
    'status=OPEN',
  ]);
  assert.deepEqual(
    queryKeys.organization.inspectionAnalyticsSummary('org-a', 'workCenterId=center-a'),
    ['private', 'org', 'org-a', 'inspections', 'analytics', 'workCenterId=center-a'],
  );
  assert.equal(isPrivateQueryKey(queryKeys.global.moduleCatalog()), false);
  assert.equal(isPrivateQueryKey(queryKeys.user.organizations('user-a')), true);
});

test('module catalog remains global while tenant state varies by organization', () => {
  const catalogForOrgA = queryKeys.global.moduleCatalog();
  const catalogForOrgB = queryKeys.global.moduleCatalog();
  assert.deepEqual(catalogForOrgA, catalogForOrgB);
  assert.notDeepEqual(
    queryKeys.organization.entitlements('org-a'),
    queryKeys.organization.entitlements('org-b'),
  );
  assert.notDeepEqual(
    queryKeys.organization.dashboard('org-a'),
    queryKeys.organization.dashboard('org-b'),
  );
});

test('organization transition aborts old work, removes old private data and preserves public/global', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let aborted = false;
  const oldRequest = queryClient
    .fetchQuery({
      queryKey: queryKeys.organization.dashboard('org-a'),
      queryFn: ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolve('aborted');
            },
            { once: true },
          );
        }),
    })
    .catch((error) => error);
  queryClient.setQueryData(queryKeys.organization.members('org-a'), ['member-a']);
  queryClient.setQueryData(queryKeys.public.solutionFinder.result('session-a'), { ok: true });
  queryClient.setQueryData(queryKeys.global.moduleCatalog(), ['module-a']);

  await isolateOrganizationTransition(queryClient, 'org-a', 'org-b', () => {
    assert.equal(
      queryClient.getQueryData(queryKeys.organization.dashboard('org-b')),
      undefined,
      'new organization must not receive old data as placeholder',
    );
  });
  const cancellation = await oldRequest;

  assert.equal(aborted, true);
  assert.equal(cancellation.constructor.name, 'CancelledError');
  assert.equal(queryClient.getQueryData(queryKeys.organization.members('org-a')), undefined);
  assert.deepEqual(queryClient.getQueryData(queryKeys.public.solutionFinder.result('session-a')), {
    ok: true,
  });
  assert.deepEqual(queryClient.getQueryData(queryKeys.global.moduleCatalog()), ['module-a']);
});

test('private cache removal isolates logout and subsequent users without deleting public/global data', async () => {
  const queryClient = new QueryClient();
  let aborted = false;
  const privateRequest = queryClient
    .fetchQuery({
      queryKey: queryKeys.organization.inspections('org-a'),
      queryFn: ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolve('aborted');
            },
            { once: true },
          );
        }),
    })
    .catch((error) => error);
  queryClient.setQueryData(queryKeys.user.organizations('user-a'), ['org-a']);
  queryClient.setQueryData(queryKeys.organization.dashboard('org-a'), { owner: 'user-a' });
  queryClient.setQueryData(queryKeys.public.solutionFinder.result('session-a'), { ok: true });
  queryClient.setQueryData(queryKeys.global.moduleCatalog(), ['module-a']);

  await removeAllPrivateQueries(queryClient);
  await privateRequest;

  assert.equal(aborted, true);
  assert.equal(queryClient.getQueryData(queryKeys.user.organizations('user-a')), undefined);
  assert.equal(queryClient.getQueryData(queryKeys.organization.dashboard('org-a')), undefined);
  assert.equal(queryClient.getQueryData(queryKeys.user.organizations('user-b')), undefined);
  assert.deepEqual(queryClient.getQueryData(queryKeys.public.solutionFinder.result('session-a')), {
    ok: true,
  });
  assert.deepEqual(queryClient.getQueryData(queryKeys.global.moduleCatalog()), ['module-a']);
});

test('active organization storage is user-scoped and validates active memberships', () => {
  const storage = memoryStorage({
    'active-organization-id': 'legacy-org',
    [activeOrganizationStorageKey('user-a')]: 'org-a',
  });
  assert.equal(resolveStoredActiveOrganization(storage, 'user-a', ['org-a']), 'org-a');
  assert.equal(storage.has('active-organization-id'), false);
  assert.equal(resolveStoredActiveOrganization(storage, 'user-b', ['org-b']), 'org-b');

  storage.setItem(activeOrganizationStorageKey('user-c'), 'org-from-another-membership');
  assert.equal(resolveStoredActiveOrganization(storage, 'user-c', ['org-c']), 'org-c');
  assert.equal(storage.has(activeOrganizationStorageKey('user-c')), false);

  storeActiveOrganization(storage, 'user-b', 'org-b', ['org-b']);
  assert.throws(
    () => storeActiveOrganization(storage, 'user-b', 'org-a', ['org-b']),
    /ACTIVE_ORGANIZATION_NOT_AVAILABLE/,
  );
  clearStoredActiveOrganization(storage, 'user-a');
  assert.equal(storage.has(activeOrganizationStorageKey('user-a')), false);
  assert.equal(storage.getItem(activeOrganizationStorageKey('user-b')), 'org-b');
});

test('active organization falls back to a valid membership when browser storage is unavailable', () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
    removeItem: () => {
      throw new Error('storage disabled');
    },
  };

  assert.equal(resolveStoredActiveOrganization(unavailableStorage, 'user-a', ['org-a']), 'org-a');
  assert.doesNotThrow(() =>
    storeActiveOrganization(unavailableStorage, 'user-a', 'org-a', ['org-a']),
  );
  assert.doesNotThrow(() => clearStoredActiveOrganization(unavailableStorage, 'user-a'));
});

test('organization refetch preserves a valid in-memory tenant when storage is unavailable', () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
    removeItem: () => {
      throw new Error('storage disabled');
    },
  };
  const storageFallback = resolveStoredActiveOrganization(unavailableStorage, 'user-a', [
    'org-a',
    'org-b',
  ]);

  assert.equal(storageFallback, 'org-a');
  assert.deepEqual(
    planOrganizationReconciliation({
      contextUserId: 'user-a',
      authenticatedUserId: 'user-a',
      activeOrganizationId: 'org-b',
      validOrganizationIds: ['org-a', 'org-b'],
      initialOrganizationId: storageFallback,
    }),
    { action: 'preserve', organizationId: 'org-b' },
  );
});

test('membership removal transitions through isolation to a valid fallback tenant', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let activeOrganizationId = 'org-b';
  let aborted = false;
  const oldRequest = queryClient
    .fetchQuery({
      queryKey: queryKeys.organization.dashboard('org-b'),
      queryFn: ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolve('aborted');
            },
            { once: true },
          );
        }),
    })
    .catch((error) => error);
  queryClient.setQueryData(queryKeys.organization.members('org-b'), ['member-b']);
  const reconciliation = planOrganizationReconciliation({
    contextUserId: 'user-a',
    authenticatedUserId: 'user-a',
    activeOrganizationId,
    validOrganizationIds: ['org-a'],
    initialOrganizationId: null,
  });

  assert.deepEqual(reconciliation, { action: 'transition', organizationId: 'org-a' });
  await isolateOrganizationTransition(
    queryClient,
    activeOrganizationId,
    reconciliation.organizationId,
    () => {
      activeOrganizationId = reconciliation.organizationId;
      assert.equal(queryClient.getQueryData(queryKeys.organization.dashboard('org-a')), undefined);
    },
  );
  await oldRequest;

  assert.equal(aborted, true);
  assert.equal(activeOrganizationId, 'org-a');
  assert.equal(queryClient.getQueryData(queryKeys.organization.members('org-b')), undefined);
});

test('membership removal clears the active tenant when no valid fallback remains', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let activeOrganizationId = 'org-b';
  let aborted = false;
  const oldRequest = queryClient
    .fetchQuery({
      queryKey: queryKeys.organization.dashboard('org-b'),
      queryFn: ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolve('aborted');
            },
            { once: true },
          );
        }),
    })
    .catch((error) => error);
  queryClient.setQueryData(queryKeys.organization.members('org-b'), ['member-b']);
  const reconciliation = planOrganizationReconciliation({
    contextUserId: 'user-a',
    authenticatedUserId: 'user-a',
    activeOrganizationId,
    validOrganizationIds: [],
    initialOrganizationId: null,
  });

  assert.deepEqual(reconciliation, { action: 'transition', organizationId: null });
  await isolateOrganizationTransition(
    queryClient,
    activeOrganizationId,
    reconciliation.organizationId,
    () => {
      activeOrganizationId = reconciliation.organizationId;
    },
  );
  await oldRequest;

  assert.equal(aborted, true);
  assert.equal(activeOrganizationId, null);
  assert.equal(queryClient.getQueryData(queryKeys.organization.members('org-b')), undefined);
});

test('reconciliation preserves private cache when the active tenant remains valid', () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.organization.dashboard('org-b'), { tenant: 'org-b' });
  const reconciliation = planOrganizationReconciliation({
    contextUserId: 'user-a',
    authenticatedUserId: 'user-a',
    activeOrganizationId: 'org-b',
    validOrganizationIds: ['org-a', 'org-b'],
    initialOrganizationId: null,
  });

  assert.deepEqual(reconciliation, { action: 'preserve', organizationId: 'org-b' });
  assert.deepEqual(queryClient.getQueryData(queryKeys.organization.dashboard('org-b')), {
    tenant: 'org-b',
  });
});
